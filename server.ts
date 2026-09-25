import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Reminder, TelegramConfig, RollbackPoint, TelegramLog, RecurrenceType } from './src/types.ts';
import { parseNaturalReminder } from './src/utils/telegramHelper.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_FILE = process.env.VERCEL ? path.join('/tmp', 'reminders_store.json') : path.join(__dirname, 'reminders_store.json');

app.use(express.json());

// In-Memory Database & Persistence
interface StoreSchema {
  reminders: Reminder[];
  telegramConfig: TelegramConfig;
  rollbacks: RollbackPoint[];
  logs: TelegramLog[];
}

function getInitialReminders(): Reminder[] {
  return [];
}

let store: StoreSchema = {
  reminders: [],
  telegramConfig: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    username: '',
    enabled: true,
    notificationsEnabled: true,
    autoBackupEnabled: true,
    lastConnectedAt: undefined,
    lastBackupAt: undefined,
    webhookUrl: process.env.APP_URL ? `${process.env.APP_URL}/api/telegram/webhook` : undefined
  },
  rollbacks: [],
  logs: []
};

// Load saved data if exists
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.reminders)) {
      store = {
        ...store,
        ...parsed,
        telegramConfig: {
          ...store.telegramConfig,
          ...(parsed.telegramConfig || {})
        }
      };
    }
  }
} catch (e) {
  console.warn('Could not load data store, using initial memory store:', e);
}

function saveStore() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving store to disk:', err);
  }
}

function addLog(type: TelegramLog['type'], message: string, success: boolean, chatId?: string) {
  const logItem: TelegramLog = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    type,
    message,
    timestamp: new Date().toISOString(),
    success,
    chatId: chatId || store.telegramConfig.chatId
  };
  store.logs.unshift(logItem);
  if (store.logs.length > 50) {
    store.logs = store.logs.slice(0, 50);
  }
  saveStore();
  return logItem;
}

// Telegram Bot API Helper
async function sendTelegramMessage(text: string, customChatId?: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const token = store.telegramConfig.botToken.trim();
  const targetChatId = (customChatId || store.telegramConfig.chatId || '').trim();

  if (!token) {
    return { success: false, error: 'Telegram Bot Token is not configured. Please add it in Telegram Hub settings.' };
  }
  if (!targetChatId) {
    return { success: false, error: 'Telegram Chat ID is not configured.' };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text,
        parse_mode: 'Markdown'
      })
    });

    const resJson = await response.json();
    if (resJson.ok) {
      addLog('reminder_sent', `Telegram message delivered to ${targetChatId}`, true, targetChatId);
      return { success: true, data: resJson.result };
    } else {
      const errDetail = resJson.description || 'Telegram API returned an error';
      addLog('error', `Telegram dispatch error: ${errDetail}`, false, targetChatId);
      return { success: false, error: errDetail };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    addLog('error', `Failed to connect to Telegram API: ${message}`, false, targetChatId);
    return { success: false, error: message };
  }
}

// Telegram Bot Token Verification via getMe API
async function verifyTelegramBot(token?: string): Promise<{ ok: boolean; username?: string; firstName?: string; error?: string }> {
  const botToken = (token || store.telegramConfig.botToken || '').trim();
  if (!botToken) {
    return { ok: false, error: 'No Telegram Bot Token provided' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json() as { ok: boolean; result?: { username?: string; first_name?: string }; description?: string };
    if (data.ok && data.result) {
      return {
        ok: true,
        username: data.result.username,
        firstName: data.result.first_name
      };
    }
    return { ok: false, error: data.description || 'Invalid Telegram Bot Token' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// Calculate next recurrence date
function calculateNextRecurrence(currentDueDate: string, recurrence: RecurrenceType, customInterval = 1): string {
  const date = new Date(currentDueDate);
  switch (recurrence) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekdays': {
      do {
        date.setDate(date.getDate() + 1);
      } while (date.getDay() === 0 || date.getDay() === 6);
      break;
    }
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'custom':
      date.setDate(date.getDate() + Math.max(1, customInterval));
      break;
    default:
      break;
  }
  return date.toISOString();
}

// Background scheduler tick checking due deadlines
async function runReminderTick() {
  const now = new Date();
  const nowMs = now.getTime();

  for (const reminder of store.reminders) {
    if (reminder.completed) continue;

    const dueMs = new Date(reminder.dueDate).getTime();
    const noticeMs = (reminder.advanceNoticeMinutes || 0) * 60 * 1000;
    const triggerMs = dueMs - noticeMs;

    // Check if this reminder is due and has not been notified
    if (nowMs >= triggerMs && !reminder.notified) {
      console.log(`[Scheduler] Due reminder: "${reminder.title}" (Due: ${reminder.dueDate})`);
      reminder.notified = true;
      reminder.notifiedAt = now.toISOString();

      // Dispatch to Telegram if configured
      if (store.telegramConfig.enabled && store.telegramConfig.botToken && store.telegramConfig.chatId) {
        const isAdvance = noticeMs > 0 && nowMs < dueMs;
        const timeFormatted = new Date(reminder.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateFormatted = new Date(reminder.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' });

        const priorityEmoji = reminder.priority === 'p1' ? '🔴 High' : reminder.priority === 'p2' ? '🟡 Medium' : '🟢 Normal';
        const msg = [
          `⏰ *NOMATIC REMEMBER ALERT*`,
          `─────────────────────────`,
          `📌 *${reminder.title}*`,
          reminder.description ? `📝 _${reminder.description}_` : '',
          `🏷️ Category: *${reminder.category.toUpperCase()}* | Priority: ${priorityEmoji}`,
          `🕒 Scheduled Time: *${timeFormatted}* (${dateFormatted})`,
          isAdvance ? `⚠️ *Advance Notice*: ${reminder.advanceNoticeMinutes}m before deadline!` : `⚡ *Status*: EXACT TIME ALERT!`,
          reminder.recurrence !== 'none' ? `🔁 Recurring: *${reminder.recurrence.toUpperCase()}*` : '',
          `─────────────────────────`,
          `Reply \`/done ${reminder.id}\` to mark completed`,
          `Reply \`/snooze ${reminder.id}\` to snooze 10m`
        ].filter(Boolean).join('\n');

        const sendResult = await sendTelegramMessage(msg);
        if (sendResult.success) {
          reminder.telegramSent = true;
        }
      }

      // If it's recurring and past due time, schedule next occurrence
      if (reminder.recurrence !== 'none' && nowMs >= dueMs) {
        const nextDue = calculateNextRecurrence(reminder.dueDate, reminder.recurrence, reminder.customIntervalDays);
        console.log(`[Scheduler] Recurring reminder advanced from ${reminder.dueDate} to ${nextDue}`);
        reminder.dueDate = nextDue;
        reminder.notified = false; // Reset for next scheduled run!
      }

      saveStore();
    }
  }
}

// Run tick every 10 seconds for exact timing
setInterval(runReminderTick, 10000);

// API Endpoints
// Status & Dashboard Overview
app.get('/api/status', (_req: Request, res: Response) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const activeReminders = store.reminders.filter(r => !r.completed);
  const todayCount = activeReminders.filter(r => r.dueDate.startsWith(todayStr)).length;
  const overdueCount = activeReminders.filter(r => new Date(r.dueDate).getTime() < now.getTime()).length;
  const completedCount = store.reminders.filter(r => r.completed).length;

  const sortedUpcoming = [...activeReminders].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  res.json({
    activeReminders: activeReminders.length,
    todayCount,
    overdueCount,
    completedCount,
    telegramConfigured: Boolean(store.telegramConfig.isVerified && store.telegramConfig.botToken && store.telegramConfig.chatId),
    rollbackCount: store.rollbacks.length,
    lastTick: now.toISOString(),
    nextScheduledReminder: sortedUpcoming[0] || null
  });
});

// GET Reminders
app.get('/api/reminders', (req: Request, res: Response) => {
  const { category, priority, completed, search } = req.query;
  let result = [...store.reminders];

  if (category && category !== 'all') {
    result = result.filter(r => r.category.toLowerCase() === String(category).toLowerCase());
  }
  if (priority && priority !== 'all') {
    result = result.filter(r => r.priority === priority);
  }
  if (completed !== undefined) {
    const isComp = completed === 'true';
    result = result.filter(r => r.completed === isComp);
  }
  if (search) {
    const query = String(search).toLowerCase();
    result = result.filter(r => r.title.toLowerCase().includes(query) || (r.description && r.description.toLowerCase().includes(query)));
  }

  // Sort: pending first, then by due date
  result.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  res.json(result);
});

// POST Create Reminder
app.post('/api/reminders', (req: Request, res: Response) => {
  const { title, description, category, priority, dueDate, advanceNoticeMinutes, recurrence, customIntervalDays } = req.body;

  if (!title || !dueDate) {
    res.status(400).json({ error: 'Title and due date are required' });
    return;
  }

  const newReminder: Reminder = {
    id: 'rem-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    title: String(title).trim(),
    description: description ? String(description).trim() : undefined,
    category: category ? String(category).toLowerCase() : 'personal',
    priority: priority || 'p2',
    dueDate: new Date(dueDate).toISOString(),
    advanceNoticeMinutes: Number(advanceNoticeMinutes) || 0,
    recurrence: recurrence || 'none',
    customIntervalDays: customIntervalDays ? Number(customIntervalDays) : undefined,
    completed: false,
    notified: false,
    telegramSent: false,
    source: 'web',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  store.reminders.unshift(newReminder);
  saveStore();

  res.status(201).json(newReminder);
});

// PUT Update Reminder
app.put('/api/reminders/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = store.reminders.findIndex(r => r.id === id);

  if (index === -1) {
    res.status(404).json({ error: 'Reminder not found' });
    return;
  }

  const existing = store.reminders[index];
  const updated: Reminder = {
    ...existing,
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  // If due date was changed, reset notified status
  if (req.body.dueDate && req.body.dueDate !== existing.dueDate) {
    updated.notified = false;
    updated.telegramSent = false;
  }

  store.reminders[index] = updated;
  saveStore();
  res.json(updated);
});

// DELETE Reminder
app.delete('/api/reminders/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const initialLength = store.reminders.length;
  store.reminders = store.reminders.filter(r => r.id !== id);

  if (store.reminders.length === initialLength) {
    res.status(404).json({ error: 'Reminder not found' });
    return;
  }

  saveStore();
  res.json({ success: true, message: 'Reminder deleted' });
});

// Toggle Complete
app.post('/api/reminders/:id/toggle', (req: Request, res: Response) => {
  const { id } = req.params;
  const reminder = store.reminders.find(r => r.id === id);

  if (!reminder) {
    res.status(404).json({ error: 'Reminder not found' });
    return;
  }

  reminder.completed = !reminder.completed;
  reminder.completedAt = reminder.completed ? new Date().toISOString() : undefined;
  reminder.updatedAt = new Date().toISOString();

  // If completing a recurring reminder, offer advance option or keep completed
  saveStore();
  res.json(reminder);
});

// Snooze Reminder
app.post('/api/reminders/:id/snooze', (req: Request, res: Response) => {
  const { id } = req.params;
  const minutes = Number(req.body.minutes) || 10;
  const reminder = store.reminders.find(r => r.id === id);

  if (!reminder) {
    res.status(404).json({ error: 'Reminder not found' });
    return;
  }

  const currentDue = new Date(reminder.dueDate).getTime();
  const baseTime = Math.max(Date.now(), currentDue);
  const newDue = new Date(baseTime + minutes * 60 * 1000);

  reminder.dueDate = newDue.toISOString();
  reminder.notified = false;
  reminder.telegramSent = false;
  reminder.completed = false;
  reminder.updatedAt = new Date().toISOString();

  saveStore();
  addLog('sync', `Snoozed "${reminder.title}" by ${minutes} minutes (New due: ${newDue.toLocaleTimeString()})`, true);

  res.json({ success: true, reminder, message: `Snoozed for ${minutes} minutes` });
});

// Telegram Config
app.get('/api/telegram/config', (_req: Request, res: Response) => {
  const cfg = { ...store.telegramConfig };
  let maskedToken = '';
  if (cfg.botToken && cfg.botToken.length > 8) {
    const visibleStart = cfg.botToken.substring(0, 5);
    const visibleEnd = cfg.botToken.substring(cfg.botToken.length - 4);
    maskedToken = `${visibleStart}...${visibleEnd}`;
  }
  res.json({
    ...cfg,
    botToken: maskedToken || cfg.botToken,
    maskedToken,
    hasToken: Boolean(store.telegramConfig.botToken && store.telegramConfig.botToken.trim().length > 0),
    isVerified: Boolean(store.telegramConfig.isVerified),
    botUsername: store.telegramConfig.botUsername || store.telegramConfig.username || ''
  });
});

// Explicit Disconnect Telegram Bot
app.post('/api/telegram/disconnect', (_req: Request, res: Response) => {
  store.telegramConfig.botToken = '';
  store.telegramConfig.chatId = '';
  store.telegramConfig.username = undefined;
  store.telegramConfig.botUsername = undefined;
  store.telegramConfig.botFirstName = undefined;
  store.telegramConfig.isVerified = false;
  store.telegramConfig.verificationError = undefined;
  saveStore();
  addLog('sync', 'Telegram Bot disconnected successfully', true);
  res.json({ success: true, message: 'Telegram Bot disconnected successfully' });
});

// Verify token on-demand
app.post('/api/telegram/verify', async (req: Request, res: Response) => {
  const token = req.body.botToken || store.telegramConfig.botToken;
  if (!token || token.includes('...')) {
    res.json({ ok: false, error: 'Please provide full unmasked Telegram Bot Token' });
    return;
  }
  const result = await verifyTelegramBot(token);
  if (result.ok && token) {
    store.telegramConfig.isVerified = true;
    store.telegramConfig.botUsername = result.username;
    store.telegramConfig.botFirstName = result.firstName;
    store.telegramConfig.verificationError = undefined;
    saveStore();
  }
  res.json(result);
});

app.post('/api/telegram/config', async (req: Request, res: Response) => {
  const { botToken, chatId, username, enabled, notificationsEnabled, autoBackupEnabled } = req.body;

  if (botToken === '') {
    // Explicit disconnect via empty token
    store.telegramConfig.botToken = '';
    store.telegramConfig.chatId = '';
    store.telegramConfig.isVerified = false;
    store.telegramConfig.botUsername = undefined;
    store.telegramConfig.botFirstName = undefined;
    store.telegramConfig.verificationError = undefined;
    saveStore();
    addLog('sync', 'Telegram Bot cleared / disconnected', true);
    res.json({
      success: true,
      isVerified: false,
      message: 'Telegram Bot disconnected successfully'
    });
    return;
  }

  if (botToken !== undefined && !botToken.includes('...')) {
    store.telegramConfig.botToken = String(botToken).trim();
  }
  if (chatId !== undefined) {
    store.telegramConfig.chatId = String(chatId).trim();
  }
  if (username !== undefined) {
    store.telegramConfig.username = String(username).trim();
  }
  if (enabled !== undefined) {
    store.telegramConfig.enabled = Boolean(enabled);
  }
  if (notificationsEnabled !== undefined) {
    store.telegramConfig.notificationsEnabled = Boolean(notificationsEnabled);
  }
  if (autoBackupEnabled !== undefined) {
    store.telegramConfig.autoBackupEnabled = Boolean(autoBackupEnabled);
  }

  // Live verification with Telegram API getMe if full token is provided
  if (store.telegramConfig.botToken && !store.telegramConfig.botToken.includes('...')) {
    const check = await verifyTelegramBot(store.telegramConfig.botToken);
    if (check.ok) {
      store.telegramConfig.isVerified = true;
      store.telegramConfig.botUsername = check.username;
      store.telegramConfig.botFirstName = check.firstName;
      store.telegramConfig.verificationError = undefined;
      store.telegramConfig.lastConnectedAt = new Date().toISOString();
      addLog('sync', `Verified bot @${check.username} (${check.firstName}) successfully`, true);
    } else {
      store.telegramConfig.isVerified = false;
      store.telegramConfig.verificationError = check.error;
      addLog('error', `Telegram bot token validation failed: ${check.error}`, false);
    }
  } else if (!store.telegramConfig.botToken) {
    store.telegramConfig.isVerified = false;
    store.telegramConfig.botUsername = undefined;
    store.telegramConfig.botFirstName = undefined;
    store.telegramConfig.verificationError = 'No bot token provided';
  }

  saveStore();
  res.json({
    success: true,
    isVerified: store.telegramConfig.isVerified,
    botUsername: store.telegramConfig.botUsername,
    verificationError: store.telegramConfig.verificationError,
    message: store.telegramConfig.isVerified
      ? `Connected to Telegram bot @${store.telegramConfig.botUsername}!`
      : store.telegramConfig.botToken
      ? `Token could not be verified: ${store.telegramConfig.verificationError}`
      : 'Settings saved (No bot token provided)'
  });
});

// Test Message
app.post('/api/telegram/test', async (req: Request, res: Response) => {
  const { testChatId } = req.body;
  const targetId = testChatId || store.telegramConfig.chatId;

  const testMessage = [
    `🔔 *NOMATIC REMEMBER — CONNECTION TEST*`,
    `─────────────────────────`,
    `✅ Your Telegram Bot connection is live and active!`,
    `📱 Recipient Chat ID: \`${targetId}\``,
    `⏰ Current System Time: *${new Date().toLocaleTimeString()}*`,
    `─────────────────────────`,
    `All your daily deadline alerts will now reach your Telegram app with *exact-time delivery* without needing the web tab open!`,
    ``,
    `Try these quick commands anytime:`,
    `• \`/remind <time> <task>\` (e.g. \`/remind 2:00 PM Team Sync\`)`,
    `• \`/list\` — See all upcoming reminders`,
    `• \`/backup\` — Instant snapshot backup`,
    `• \`/rollback\` — Restore prior snapshot`
  ].join('\n');

  const result = await sendTelegramMessage(testMessage, targetId);
  if (result.success) {
    res.json({ success: true, message: 'Test message sent to Telegram successfully!' });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

// Backup to Telegram & Rollback Creation
app.post('/api/telegram/backup', async (req: Request, res: Response) => {
  const now = new Date();
  const label = req.body.label || `Backup Snapshot (${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;

  const snapshot: Reminder[] = JSON.parse(JSON.stringify(store.reminders));
  const rollbackPoint: RollbackPoint = {
    id: 'rb-' + Date.now(),
    timestamp: now.toISOString(),
    label,
    reminderCount: snapshot.length,
    triggeredBy: req.body.triggeredBy || 'manual',
    dataSnapshot: snapshot
  };

  store.rollbacks.unshift(rollbackPoint);
  if (store.rollbacks.length > 30) {
    store.rollbacks = store.rollbacks.slice(0, 30);
  }
  store.telegramConfig.lastBackupAt = now.toISOString();
  saveStore();

  // Also dispatch summary backup to Telegram if connected
  let telegramDelivered = false;
  if (store.telegramConfig.botToken && store.telegramConfig.chatId) {
    const backupSummary = [
      `💾 *NOMATIC REMEMBER — DATA BACKUP CREATED*`,
      `─────────────────────────`,
      `🏷️ Snapshot ID: \`${rollbackPoint.id}\``,
      `📅 Timestamp: *${now.toLocaleString()}*`,
      `📋 Total Reminders Preserved: *${snapshot.length}*`,
      `🔒 Rollback Mechanism: Ready`,
      `─────────────────────────`,
      `You can restore to this state anytime via the Web App or by sending \`/rollback\` to this bot.`
    ].join('\n');

    const tgRes = await sendTelegramMessage(backupSummary);
    telegramDelivered = tgRes.success;
  }

  addLog('backup_sent', `Saved backup snapshot "${label}" (${snapshot.length} tasks)`, true);

  res.json({
    success: true,
    rollbackPoint,
    telegramDelivered,
    message: 'Backup created and saved to rollback history'
  });
});

// GET Rollbacks
app.get('/api/telegram/rollbacks', (_req: Request, res: Response) => {
  res.json(store.rollbacks);
});

// Restore Rollback
app.post('/api/telegram/rollback/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const targetPoint = store.rollbacks.find(r => r.id === id);

  if (!targetPoint) {
    res.status(404).json({ error: 'Rollback snapshot not found' });
    return;
  }

  // Create auto pre-restore safety checkpoint
  const currentSnapshot: Reminder[] = JSON.parse(JSON.stringify(store.reminders));
  store.rollbacks.unshift({
    id: 'rb-auto-safety-' + Date.now(),
    timestamp: new Date().toISOString(),
    label: `Safety Snapshot before restoring "${targetPoint.label}"`,
    reminderCount: currentSnapshot.length,
    triggeredBy: 'pre_restore',
    dataSnapshot: currentSnapshot
  });

  // Restore
  store.reminders = JSON.parse(JSON.stringify(targetPoint.dataSnapshot));
  saveStore();

  addLog('rollback_restored', `Successfully rolled back to snapshot "${targetPoint.label}"`, true);

  res.json({
    success: true,
    restoredCount: store.reminders.length,
    message: `Successfully rolled back to: ${targetPoint.label}`
  });
});

// Restore from raw JSON payload
app.post('/api/telegram/restore-json', (req: Request, res: Response) => {
  const { jsonContent } = req.body;
  try {
    const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    const remindersArray = Array.isArray(parsed) ? parsed : parsed.reminders;

    if (!Array.isArray(remindersArray)) {
      res.status(400).json({ error: 'Invalid backup JSON format. Array of reminders expected.' });
      return;
    }

    // Safety backup
    store.rollbacks.unshift({
      id: 'rb-json-safety-' + Date.now(),
      timestamp: new Date().toISOString(),
      label: 'Safety Snapshot before JSON restore',
      reminderCount: store.reminders.length,
      triggeredBy: 'pre_restore',
      dataSnapshot: JSON.parse(JSON.stringify(store.reminders))
    });

    store.reminders = remindersArray;
    saveStore();
    addLog('rollback_restored', `Imported ${remindersArray.length} reminders from JSON backup`, true);

    res.json({ success: true, restoredCount: remindersArray.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: `Failed to parse JSON backup: ${message}` });
  }
});

// Logs
app.get('/api/telegram/logs', (_req: Request, res: Response) => {
  res.json(store.logs);
});

// Webhook / Message Processing Engine
async function handleTelegramIncomingText(chatId: string | number, text: string, username?: string): Promise<string> {
  const trimmed = text.trim();
  const cId = String(chatId);

  // If user chat ID is not set or matches, update it
  if (!store.telegramConfig.chatId) {
    store.telegramConfig.chatId = cId;
    if (username) store.telegramConfig.username = username;
    saveStore();
  }

  addLog('bot_received', `Received from @${username || cId}: "${trimmed}"`, true, cId);

  // /start command
  if (/^\/start/i.test(trimmed)) {
    return [
      `👋 *Welcome to Nomatic Remember!*`,
      `─────────────────────────`,
      `Your Telegram account is connected to Nomatic Remember!`,
      `🔑 *Your Chat ID*: \`${cId}\``,
      ``,
      `*How to use:*`,
      `• \`/remind <time> <task>\` — Set an exact-time reminder (e.g. \`/remind 2:00 PM Team Sync\`)`,
      `• \`/remind tomorrow 5:00 PM Gym session\` — Plan ahead`,
      `• \`<task> at <time>\` — Quick natural language (e.g. \`Call client at 3pm\`)`,
      `• \`/list\` — View all active reminders`,
      `• \`/done <id>\` — Mark a reminder completed`,
      `• \`/backup\` — Trigger an instant data backup snapshot`,
      `• \`/rollback\` — Restore your last backup snapshot`,
      `─────────────────────────`,
      `Exact-time notifications will arrive here even with your web app closed.`
    ].join('\n');
  }

  // /id command
  if (/^\/(?:id|chatid)/i.test(trimmed)) {
    return `🆔 Your Telegram Chat ID is: \`${cId}\`\nPaste this in the Nomatic Remember Web App Settings!`;
  }

  // /list command
  if (/^\/(?:list|tasks)/i.test(trimmed)) {
    const active = store.reminders.filter(r => !r.completed);
    if (active.length === 0) {
      return `🎉 No pending reminders! All caught up.\nSend a reminder or /help to create one!`;
    }
    const lines = active.slice(0, 10).map((r, i) => {
      const dateStr = new Date(r.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(r.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' });
      return `${i + 1}. *${r.title}*\n   🕒 ${dateStr} | 🏷️ ${r.category} | ID: \`${r.id}\``;
    });
    return `📋 *Active Reminders (${active.length}):*\n─────────────────────────\n${lines.join('\n\n')}\n─────────────────────────\nReply \`/done <id>\` to complete.`;
  }

  // /done command
  const doneMatch = trimmed.match(/^\/done\s+(.+)/i);
  if (doneMatch) {
    const targetId = doneMatch[1].trim();
    // match by ID or index
    let reminder = store.reminders.find(r => r.id === targetId || r.id.endsWith(targetId));
    if (!reminder && !isNaN(Number(targetId))) {
      const idx = Number(targetId) - 1;
      const active = store.reminders.filter(r => !r.completed);
      if (active[idx]) reminder = active[idx];
    }

    if (reminder) {
      reminder.completed = true;
      reminder.completedAt = new Date().toISOString();
      saveStore();
      return `✅ Marked as completed: *${reminder.title}*! Great job!`;
    } else {
      return `❌ Could not find reminder with ID: \`${targetId}\`. Send \`/list\` to check your IDs.`;
    }
  }

  // /snooze command
  const snoozeMatch = trimmed.match(/^\/snooze\s+(.+)/i);
  if (snoozeMatch) {
    const targetId = snoozeMatch[1].trim();
    const reminder = store.reminders.find(r => r.id === targetId || r.id.endsWith(targetId));
    if (reminder) {
      const newTime = new Date(Date.now() + 10 * 60 * 1000);
      reminder.dueDate = newTime.toISOString();
      reminder.notified = false;
      reminder.telegramSent = false;
      saveStore();
      return `⏳ Snoozed *${reminder.title}* by 10 minutes until *${newTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}*.`;
    }
  }

  // /backup command
  if (/^\/backup/i.test(trimmed)) {
    const now = new Date();
    const snapshot: Reminder[] = JSON.parse(JSON.stringify(store.reminders));
    store.rollbacks.unshift({
      id: 'rb-' + Date.now(),
      timestamp: now.toISOString(),
      label: `Telegram Bot /backup (${now.toLocaleTimeString()})`,
      reminderCount: snapshot.length,
      triggeredBy: 'telegram_command',
      dataSnapshot: snapshot
    });
    saveStore();
    return `💾 *Backup Created Successfully!*\nSaved snapshot with ${snapshot.length} tasks.\nYou can rollback anytime with \`/rollback\`.`;
  }

  // /rollback command
  if (/^\/rollback/i.test(trimmed)) {
    if (store.rollbacks.length === 0) {
      return `⚠️ No previous rollback snapshot found. Create one with \`/backup\`.`;
    }
    const latest = store.rollbacks[0];
    store.reminders = JSON.parse(JSON.stringify(latest.dataSnapshot));
    saveStore();
    return `🔄 *Rolled Back Successfully!*\nRestored to snapshot: *${latest.label}* (${store.reminders.length} tasks restored).`;
  }

  // Reminder creation (via /remind or natural language)
  const parsed = parseNaturalReminder(trimmed);
  const newReminder: Reminder = {
    id: 'rem-tg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
    title: parsed.title,
    category: parsed.category,
    priority: parsed.priority,
    dueDate: parsed.dueDate,
    advanceNoticeMinutes: 0,
    recurrence: parsed.recurrence,
    completed: false,
    notified: false,
    telegramSent: false,
    source: 'telegram',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  store.reminders.unshift(newReminder);
  saveStore();

  const formattedTime = new Date(newReminder.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedDate = new Date(newReminder.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' });

  return [
    `✅ *Reminder Scheduled!*`,
    `─────────────────────────`,
    `📌 *${newReminder.title}*`,
    `🕒 Time: *${formattedTime}* (${formattedDate})`,
    `🏷️ Category: *${newReminder.category.toUpperCase()}*`,
    newReminder.recurrence !== 'none' ? `🔁 Recurring: *${newReminder.recurrence.toUpperCase()}*` : '',
    `🆔 ID: \`${newReminder.id}\``,
    `─────────────────────────`,
    `You will receive an exact-time alert on Telegram when this is due!`
  ].filter(Boolean).join('\n');
}

// Telegram Webhook Endpoint
app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
  try {
    const update = req.body;
    if (update && update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const username = update.message.from?.username || update.message.from?.first_name;

      const reply = await handleTelegramIncomingText(chatId, text, username);
      await sendTelegramMessage(reply, String(chatId));
    }
    res.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Webhook error:', message);
    res.status(500).json({ error: message });
  }
});

// Simulate Telegram Message (For UI Testing & Sandbox Verification)
app.post('/api/telegram/simulate', async (req: Request, res: Response) => {
  const { text, chatId } = req.body;
  if (!text) {
    res.status(400).json({ error: 'Text is required' });
    return;
  }

  const targetChatId = chatId || store.telegramConfig.chatId || 'simulated-user';
  const reply = await handleTelegramIncomingText(targetChatId, text, 'TestUser');

  res.json({
    incoming: text,
    reply,
    systemRemindersCount: store.reminders.length
  });
});

// Vercel Cron Endpoint (`/api/cron/tick`)
app.get('/api/cron/tick', async (_req: Request, res: Response) => {
  await runReminderTick();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeCount: store.reminders.filter(r => !r.completed).length
  });
});

// Vite / Static Files Setup
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Nomatic Remember] Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
