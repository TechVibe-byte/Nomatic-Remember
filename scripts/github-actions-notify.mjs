#!/usr/bin/env node

/**
 * Nomatic Remember — GitHub Actions Notification Dispatcher
 *
 * Runs on GitHub Actions scheduled cron (e.g. every 15 mins) or manual workflow_dispatch.
 * Triggers the reminder check & exact-time Telegram dispatch.
 * Also appends a rich Markdown report to $GITHUB_STEP_SUMMARY.
 */

import fs from 'fs';
import path from 'path';

const APP_URL = (process.env.APP_URL || '').replace(/\/+$/, '');
const GITHUB_ACTIONS_SECRET = process.env.GITHUB_ACTIONS_SECRET || process.env.CRON_SECRET || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const ACTION_TYPE = process.env.ACTION_TYPE || 'tick'; // 'tick' | 'digest' | 'test'
const FORCE_NOTIFY = process.env.FORCE_NOTIFY === 'true';
const SUMMARY_FILE = process.env.GITHUB_STEP_SUMMARY;

async function sendTelegramDirect(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return { ok: false, description: 'Telegram credentials not provided in environment' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown'
      })
    });
    return await res.json();
  } catch (err) {
    return { ok: false, description: err.message };
  }
}

async function writeStepSummary(markdown) {
  if (SUMMARY_FILE) {
    try {
      fs.appendFileSync(SUMMARY_FILE, markdown + '\n\n', 'utf-8');
    } catch (e) {
      console.warn('Could not write to GITHUB_STEP_SUMMARY:', e.message);
    }
  }
}

async function main() {
  console.log('⏰ [GitHub Actions] Starting Nomatic Remember notification runner...');
  const startTime = Date.now();
  const now = new Date();
  const nowIso = now.toISOString();

  let executionResult = null;
  let sourceMode = 'unknown';

  // Strategy 1: Trigger live web application endpoint
  if (APP_URL) {
    sourceMode = 'app_endpoint';
    const targetUrl = `${APP_URL}/api/github-actions/run`;
    console.log(`🌐 Pinging app endpoint: ${targetUrl} (Action: ${ACTION_TYPE})`);

    try {
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'NomaticRemember-GitHubActions/1.0'
      };
      if (GITHUB_ACTIONS_SECRET) {
        headers['Authorization'] = `Bearer ${GITHUB_ACTIONS_SECRET}`;
        headers['x-cron-secret'] = GITHUB_ACTIONS_SECRET;
      }

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: ACTION_TYPE,
          forceNotify: FORCE_NOTIFY,
          source: 'github_actions',
          githubRunId: process.env.GITHUB_RUN_ID,
          githubWorkflow: process.env.GITHUB_WORKFLOW,
          githubEvent: process.env.GITHUB_EVENT_NAME
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Endpoint returned HTTP ${response.status}: ${text}`);
      }

      executionResult = await response.json();
      console.log('✅ Remote endpoint responded successfully:', executionResult);
    } catch (err) {
      console.error(`⚠️ Remote trigger failed (${err.message}). Trying fallback direct mode...`);
    }
  }

  // Strategy 2: Fallback / Standalone repository file evaluation
  if (!executionResult) {
    sourceMode = 'standalone_runner';
    console.log('📂 Running in standalone runner mode...');

    let reminders = [];
    const storePath = path.resolve('reminders_store.json');
    if (fs.existsSync(storePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
        reminders = raw.reminders || [];
      } catch (err) {
        console.warn('Could not read reminders_store.json:', err.message);
      }
    }

    const nowMs = now.getTime();
    const active = reminders.filter(r => !r.completed);
    const notifiedList = [];

    if (ACTION_TYPE === 'digest') {
      const todayStr = nowIso.split('T')[0];
      const todayTasks = active.filter(r => r.dueDate.startsWith(todayStr));

      let digestMsg = `🌅 *NOMATIC REMEMBER — DAILY DIGEST (GitHub Actions)*\n` +
        `─────────────────────────\n` +
        `📅 Date: *${now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}*\n` +
        `📌 Tasks Due Today: *${todayTasks.length}*\n` +
        `📋 Total Active Reminders: *${active.length}*\n` +
        `─────────────────────────\n`;

      if (todayTasks.length === 0) {
        digestMsg += `🎉 No tasks scheduled for today! You are all caught up.\n`;
      } else {
        todayTasks.forEach((t, i) => {
          const time = new Date(t.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const priorityBadge = t.priority === 'p1' ? '🔴' : t.priority === 'p2' ? '🟡' : '🟢';
          digestMsg += `${i + 1}. ${priorityBadge} *${t.title}* at *${time}*\n`;
        });
      }

      if (APP_URL) {
        digestMsg += `\n🔗 [Open Web App](${APP_URL})\n`;
      }

      const tgRes = await sendTelegramDirect(digestMsg);
      executionResult = {
        success: true,
        action: 'digest',
        checkedCount: active.length,
        notifiedCount: todayTasks.length,
        telegramDelivered: tgRes.ok,
        notifiedTitles: todayTasks.map(t => t.title),
        message: `Dispatched daily digest for ${todayTasks.length} tasks`
      };
    } else {
      // Standard exact-time tick check
      for (const reminder of active) {
        const dueMs = new Date(reminder.dueDate).getTime();
        const noticeMs = (reminder.advanceNoticeMinutes || 0) * 60 * 1000;
        const triggerMs = dueMs - noticeMs;

        if ((nowMs >= triggerMs && !reminder.notified) || FORCE_NOTIFY) {
          notifiedList.push(reminder);
          const timeFormatted = new Date(reminder.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateFormatted = new Date(reminder.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' });
          const priorityEmoji = reminder.priority === 'p1' ? '🔴 High' : reminder.priority === 'p2' ? '🟡 Medium' : '🟢 Normal';

          const msg = [
            `⏰ *NOMATIC REMEMBER ALERT (via GitHub Actions)*`,
            `─────────────────────────`,
            `📌 *${reminder.title}*`,
            reminder.description ? `📝 _${reminder.description}_` : '',
            `🏷️ Category: *${reminder.category.toUpperCase()}* | Priority: ${priorityEmoji}`,
            `🕒 Due Time: *${timeFormatted}* (${dateFormatted})`,
            `⚡ Triggered by: GitHub Actions automated cron runner`,
            `─────────────────────────`
          ].filter(Boolean).join('\n');

          await sendTelegramDirect(msg);
        }
      }

      executionResult = {
        success: true,
        action: 'tick',
        checkedCount: active.length,
        notifiedCount: notifiedList.length,
        notifiedTitles: notifiedList.map(r => r.title),
        message: notifiedList.length > 0
          ? `Dispatched ${notifiedList.length} due reminders via GitHub Actions`
          : 'All reminders up to date. No due notifications needed.'
      };
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(`⏱️ Finished in ${durationMs}ms with status:`, executionResult.success ? 'SUCCESS' : 'FAILED');

  // Generate GitHub Step Summary Markdown
  const eventName = process.env.GITHUB_EVENT_NAME || 'manual';
  const runId = process.env.GITHUB_RUN_ID || 'local';
  const checked = executionResult.checkedCount ?? 0;
  const notified = executionResult.notifiedCount ?? 0;
  const titles = executionResult.notifiedTitles || [];

  const summaryMarkdown = [
    `# ⏰ Nomatic Remember — Notification Runner`,
    ``,
    `| Metric | Value |`,
    `| :--- | :--- |`,
    `| **Status** | ${executionResult.success ? '✅ Success' : '❌ Failed'} |`,
    `| **Action Type** | \`${ACTION_TYPE}\` |`,
    `| **Trigger Event** | \`${eventName}\` |`,
    `| **Execution Mode** | \`${sourceMode}\` |`,
    `| **Reminders Evaluated** | **${checked}** |`,
    `| **Alerts Dispatched** | **${notified}** |`,
    `| **Execution Time** | ${durationMs}ms |`,
    `| **Timestamp** | ${nowIso} |`,
    ``,
    notified > 0
      ? `### 📢 Alerts Dispatched in this Run:\n` + titles.map(t => `- 🔔 **${t}**`).join('\n')
      : `> ℹ️ **No pending alerts were due at this tick.** All deadlines are in the future or already acknowledged.`,
    ``,
    APP_URL ? `[🌐 Open Nomatic Remember Dashboard](${APP_URL})` : ''
  ].join('\n');

  await writeStepSummary(summaryMarkdown);
}

main().catch(async (err) => {
  console.error('❌ GitHub Actions Notification Runner fatal error:', err);
  await writeStepSummary(`## ❌ Nomatic Remember Runner Error\n\n\`\`\`\n${err.stack || err.message}\n\`\`\``);
  process.exit(1);
});
