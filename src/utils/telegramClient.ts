import { Reminder, TelegramConfig, RollbackPoint, TelegramLog, RecurrenceType } from '../types.ts';

const STORAGE_KEYS = {
  REMINDERS: 'nomatic_reminders_v1',
  CONFIG: 'nomatic_tg_config_v1',
  ROLLBACKS: 'nomatic_rollbacks_v1',
  LOGS: 'nomatic_logs_v1'
};

/**
 * Safe JSON fetcher that checks Content-Type header.
 * Prevents "JSON.parse: unexpected character at line 1 column 1" when a host
 * (like Vercel, Netlify, or GitHub Pages) returns index.html for API routes.
 */
export async function safeFetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; data?: T; isHtmlFallback?: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';

    // If host returned HTML instead of JSON (typical SPA fallback)
    if (contentType.includes('text/html')) {
      return {
        ok: false,
        isHtmlFallback: true,
        status: res.status,
        error: 'Host returned HTML page instead of API response (static mode).'
      };
    }

    if (!contentType.includes('application/json')) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        status: res.status,
        error: text.substring(0, 150) || `Unexpected content-type: ${contentType}`
      };
    }

    const data = (await res.json()) as T;
    return {
      ok: res.ok,
      data,
      status: res.status,
      error: !res.ok && data && typeof data === 'object' && 'error' in data ? String((data as { error: string }).error) : undefined
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      error: msg
    };
  }
}

/**
 * Direct Telegram Bot Token verification via official Telegram Bot API (getMe).
 * Works directly from the browser because Telegram Bot API enables CORS (Access-Control-Allow-Origin: *).
 */
export async function verifyTelegramTokenDirect(token: string): Promise<{
  ok: boolean;
  username?: string;
  firstName?: string;
  error?: string;
}> {
  const clean = token.trim();
  if (!clean) {
    return { ok: false, error: 'Please enter a Telegram Bot API Token.' };
  }

  try {
    const url = `https://api.telegram.org/bot${clean}/getMe`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      ok: boolean;
      result?: { username?: string; first_name?: string };
      description?: string;
      error_code?: number;
    };

    if (data.ok && data.result) {
      return {
        ok: true,
        username: data.result.username,
        firstName: data.result.first_name
      };
    }

    const description = data.description || 'Invalid Telegram Bot Token';
    return {
      ok: false,
      error: description.includes('Unauthorized')
        ? 'Telegram returned "Unauthorized". Please verify your Bot Token from @BotFather.'
        : `Telegram error: ${description}`
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Network error reaching Telegram: ${msg}`
    };
  }
}

/**
 * Direct Telegram message dispatch via official Telegram Bot API (sendMessage).
 */
export async function sendTelegramMessageDirect(
  token: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  let cleanToken = token.trim();
  const cleanChatId = chatId.trim();

  // If token provided is masked, retrieve full unmasked token from local config
  if (cleanToken.includes('...')) {
    const stored = getLocalConfig();
    if (stored.botToken && !stored.botToken.includes('...')) {
      cleanToken = stored.botToken.trim();
    }
  }

  if (!cleanToken || cleanToken.includes('...')) {
    return { ok: false, error: 'Valid Telegram Bot Token is not configured. Please paste your Bot Token from @BotFather.' };
  }
  if (!cleanChatId) {
    return { ok: false, error: 'Telegram Chat ID is not configured.' };
  }

  try {
    const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text,
        parse_mode: 'Markdown'
      })
    });

    const data = (await res.json()) as { ok: boolean; description?: string };
    if (data.ok) {
      addLocalLog('reminder_sent', `Message sent to ${cleanChatId} via Telegram API`, true, cleanChatId);
      return { ok: true };
    } else {
      const err = data.description || 'Telegram API returned an error';
      addLocalLog('error', `Telegram error: ${err}`, false, cleanChatId);
      return { ok: false, error: err };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    addLocalLog('error', `Dispatch error: ${msg}`, false, cleanChatId);
    return { ok: false, error: msg };
  }
}

// Local Storage Fallback Helpers
export function getLocalReminders(): Reminder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REMINDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Could not read reminders from localStorage:', e);
  }
  return [];
}

export function saveLocalReminders(rems: Reminder[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(rems));
  } catch (e) {
    console.warn('Could not write reminders to localStorage:', e);
  }
}

export function getLocalConfig(): TelegramConfig {
  const def: TelegramConfig = {
    botToken: '',
    chatId: '',
    username: '',
    enabled: true,
    notificationsEnabled: true,
    autoBackupEnabled: true,
    isVerified: false
  };
  if (typeof window === 'undefined') return def;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...def, ...parsed };
    }
  } catch (e) {
    console.warn('Could not read config from localStorage:', e);
  }
  return def;
}

export function saveLocalConfig(cfg: TelegramConfig): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = getLocalConfig();
    // Preserve full unmasked botToken if new cfg has a masked token
    const tokenToSave =
      cfg.botToken && !cfg.botToken.includes('...')
        ? cfg.botToken
        : prev.botToken && !prev.botToken.includes('...')
        ? prev.botToken
        : cfg.botToken || '';

    const sanitized: TelegramConfig = {
      ...cfg,
      botToken: tokenToSave
    };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(sanitized));
  } catch (e) {
    console.warn('Could not write config to localStorage:', e);
  }
}

export function disconnectTelegramLocal(): TelegramConfig {
  const cleared: TelegramConfig = {
    botToken: '',
    chatId: '',
    username: '',
    botUsername: '',
    botFirstName: '',
    enabled: false,
    notificationsEnabled: false,
    autoBackupEnabled: false,
    isVerified: false,
    verificationError: undefined
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(cleared));
      addLocalLog('sync', 'Telegram bot disconnected and cleared', true);
    } catch {
      // ignore
    }
  }
  return cleared;
}

export function getLocalRollbacks(): RollbackPoint[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ROLLBACKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Could not read rollbacks from localStorage:', e);
  }
  return [];
}

export function saveLocalRollbacks(rollbacks: RollbackPoint[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.ROLLBACKS, JSON.stringify(rollbacks.slice(0, 30)));
  } catch (e) {
    console.warn('Could not write rollbacks to localStorage:', e);
  }
}

export function getLocalLogs(): TelegramLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Could not read logs from localStorage:', e);
  }
  return [];
}

export function addLocalLog(type: TelegramLog['type'], message: string, success: boolean, chatId?: string): TelegramLog {
  const logItem: TelegramLog = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    type,
    message,
    timestamp: new Date().toISOString(),
    success,
    chatId
  };
  if (typeof window !== 'undefined') {
    try {
      const existing = getLocalLogs();
      const updated = [logItem, ...existing].slice(0, 50);
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updated));
    } catch {
      // ignore storage error
    }
  }
  return logItem;
}

export function calculateNextRecurrence(currentDueDate: string, recurrence: RecurrenceType, customInterval = 1): string {
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
