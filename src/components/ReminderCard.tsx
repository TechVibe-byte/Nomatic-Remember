import React from 'react';
import { Reminder } from '../types.ts';
import { getCategoryMeta, getCategoryBadgeClasses } from '../utils/categories.ts';
import {
  Check,
  Clock,
  Repeat,
  Send,
  MoreVertical,
  Trash2,
  Edit2,
  AlarmClock
} from 'lucide-react';

interface ReminderCardProps {
  reminder: Reminder;
  onToggle: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onSendTelegramImmediate: (reminder: Reminder) => void;
  telegramConfigured: boolean;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder,
  onToggle,
  onEdit,
  onDelete,
  onSnooze,
  onSendTelegramImmediate,
  telegramConfigured
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const categoryMeta = getCategoryMeta(reminder.category);
  const badgeClasses = getCategoryBadgeClasses(categoryMeta.color);

  const dueDate = new Date(reminder.dueDate);
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const isOverdue = diffMs < 0 && !reminder.completed;
  const isImminent = diffMs > 0 && diffMs < 60 * 60 * 1000 && !reminder.completed;

  // Format time and date
  const timeStr = dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = dueDate.toDateString() === now.toDateString();
  const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === dueDate.toDateString();
  const dateStr = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : dueDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

  // Priority indicator
  const priorityLabel = reminder.priority === 'p1' ? 'P1 High' : reminder.priority === 'p2' ? 'P2 Medium' : reminder.priority === 'p3' ? 'P3 Normal' : 'P4 Low';

  return (
    <div
      className={`material-card group relative flex flex-col justify-between rounded-xl border p-4 sm:p-5 transition-all ${
        reminder.completed
          ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
          : isOverdue
          ? 'bg-red-950/20 border-red-800/40 shadow-sm shadow-red-950/30'
          : isImminent
          ? 'bg-amber-950/20 border-amber-700/50 shadow-sm shadow-amber-950/30'
          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start gap-3.5">
        {/* Tactile Material Checkbox Button */}
        <button
          onClick={() => onToggle(reminder.id)}
          aria-label={reminder.completed ? 'Mark uncompleted' : 'Mark completed'}
          className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all duration-150 cursor-pointer ${
            reminder.completed
              ? 'bg-emerald-500 border-emerald-500 text-slate-950'
              : 'border-slate-600 hover:border-amber-400 bg-slate-800/80 hover:bg-slate-800'
          }`}
        >
          {reminder.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>

        {/* Content body */}
        <div className="min-w-0 flex-1">
          {/* Card Title */}
          <div className="flex items-center justify-between gap-2">
            <h3
              className={`text-base font-semibold tracking-tight transition-colors ${
                reminder.completed
                  ? 'line-through text-slate-500'
                  : 'text-slate-100 group-hover:text-amber-300'
              }`}
            >
              {reminder.title}
            </h3>

            {/* Context menu toggle */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-md hover:bg-slate-800 transition-colors"
                title="Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-7 z-50 w-44 rounded-xl border border-slate-800 bg-slate-900/95 p-1 shadow-xl backdrop-blur-md">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit(reminder);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit reminder</span>
                    </button>
                    {telegramConfigured && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onSendTelegramImmediate(reminder);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-sky-400 hover:bg-slate-800"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send to Telegram now</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete(reminder.id);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-950/50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Description if present */}
          {reminder.description && (
            <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {reminder.description}
            </p>
          )}

          {/* Zero-Pill Metadata row with typographic separators */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
            {/* Category dot + unboxed label */}
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${badgeClasses.dot}`} />
              <span className={badgeClasses.text}>{categoryMeta.name}</span>
            </span>

            <span aria-hidden="true" className="text-slate-600">·</span>

            {/* Due date & time with tabular numerals */}
            <span
              className={`flex items-center gap-1 font-mono tabular-nums ${
                isOverdue
                  ? 'text-red-400 font-semibold'
                  : isImminent
                  ? 'text-amber-400 font-semibold'
                  : 'text-slate-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{dateStr}, {timeStr}</span>
            </span>

            {/* Recurrence text */}
            {reminder.recurrence !== 'none' && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="flex items-center gap-1 text-slate-400">
                  <Repeat className="w-3.5 h-3.5 text-amber-500/80" />
                  <span className="capitalize">{reminder.recurrence}</span>
                </span>
              </>
            )}

            <span aria-hidden="true" className="text-slate-600">·</span>

            {/* Priority */}
            <span
              className={
                reminder.priority === 'p1'
                  ? 'text-red-400 font-semibold'
                  : reminder.priority === 'p2'
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }
            >
              {priorityLabel}
            </span>

            {/* Telegram Sync Marker */}
            {reminder.telegramSent && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="flex items-center gap-1 text-sky-400 text-[11px]" title="Alert delivered to Telegram">
                  <Send className="w-3 h-3" />
                  <span>TG Sent</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action footer: Quick Snooze / Status */}
      {!reminder.completed && (
        <div className="mt-3.5 flex items-center justify-between border-t border-slate-800/80 pt-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Quick Snooze:</span>
            <button
              onClick={() => onSnooze(reminder.id, 10)}
              className="px-2 py-0.5 text-[11px] font-mono rounded bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              +10m
            </button>
            <button
              onClick={() => onSnooze(reminder.id, 60)}
              className="px-2 py-0.5 text-[11px] font-mono rounded bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              +1h
            </button>
            <button
              onClick={() => onSnooze(reminder.id, 1440)}
              className="px-2 py-0.5 text-[11px] font-mono rounded bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              +1d
            </button>
          </div>

          {reminder.advanceNoticeMinutes > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-amber-400/90 font-mono">
              <AlarmClock className="w-3 h-3" />
              <span>{reminder.advanceNoticeMinutes}m early alert</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
