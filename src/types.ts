export type Priority = 'p1' | 'p2' | 'p3' | 'p4';

export type RecurrenceType =
  | 'none'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'custom';

export interface CategoryInfo {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: Priority;
  dueDate: string; // ISO String (e.g. 2026-09-24T07:00:00.000Z)
  advanceNoticeMinutes: number; // 0 = at time of event, 5, 15, 30, 60, etc.
  recurrence: RecurrenceType;
  customIntervalDays?: number;
  completed: boolean;
  completedAt?: string;
  notified: boolean;
  notifiedAt?: string;
  telegramSent: boolean;
  source: 'web' | 'telegram' | 'recurring_generator';
  createdAt: string;
  updatedAt: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  username?: string;
  botUsername?: string;
  botFirstName?: string;
  enabled: boolean;
  notificationsEnabled: boolean;
  autoBackupEnabled: boolean;
  lastConnectedAt?: string;
  lastBackupAt?: string;
  webhookUrl?: string;
  hasToken?: boolean;
  isVerified?: boolean;
  verificationError?: string;
}

export interface RollbackPoint {
  id: string;
  timestamp: string;
  label: string;
  reminderCount: number;
  triggeredBy: 'manual' | 'auto_sync' | 'telegram_command' | 'pre_restore';
  dataSnapshot: Reminder[];
  telegramMessageId?: number;
}

export interface TelegramLog {
  id: string;
  type: 'reminder_sent' | 'bot_received' | 'backup_sent' | 'rollback_restored' | 'test' | 'error' | 'sync';
  message: string;
  timestamp: string;
  success: boolean;
  chatId?: string;
}

export interface SystemStatus {
  activeReminders: number;
  todayCount: number;
  overdueCount: number;
  completedCount: number;
  telegramConfigured: boolean;
  rollbackCount: number;
  lastTick: string;
  nextScheduledReminder?: Reminder;
}
