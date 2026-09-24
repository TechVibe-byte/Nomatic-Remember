import React from 'react';
import { Reminder } from '../types.ts';
import { Bell, Check, Clock, X, Send } from 'lucide-react';

interface NotificationBannerProps {
  activeNotification: Reminder | null;
  onDismiss: () => void;
  onMarkDone: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  activeNotification,
  onDismiss,
  onMarkDone,
  onSnooze
}) => {
  if (!activeNotification) return null;

  const timeStr = new Date(activeNotification.dueDate).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed top-20 right-4 z-50 max-w-sm w-full animate-bounce-short">
      <div className="rounded-2xl border-2 border-amber-400/80 bg-slate-900/95 p-4 shadow-2xl shadow-amber-500/20 backdrop-blur-xl text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-950 font-bold">
              <Bell className="w-5 h-5 animate-wiggle" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                Deadline Alert Right Now!
              </span>
              <h4 className="text-sm font-bold text-white tracking-tight leading-snug">
                {activeNotification.title}
              </h4>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {activeNotification.description && (
          <p className="mt-2 text-xs text-slate-300 line-clamp-2">
            {activeNotification.description}
          </p>
        )}

        <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1 text-amber-300">
            <Clock className="w-3.5 h-3.5" />
            <span>Scheduled: {timeStr}</span>
          </span>
          {activeNotification.telegramSent && (
            <span className="flex items-center gap-1 text-sky-400 text-[11px]">
              <Send className="w-3 h-3" />
              <span>Telegram sent</span>
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={() => onMarkDone(activeNotification.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Complete</span>
          </button>
          <button
            onClick={() => onSnooze(activeNotification.id, 10)}
            className="py-1.5 px-3 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Snooze 10m
          </button>
        </div>
      </div>
    </div>
  );
};
