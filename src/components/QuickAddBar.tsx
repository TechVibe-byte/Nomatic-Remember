import React, { useState } from 'react';
import { parseNaturalReminder } from '../utils/telegramHelper.ts';
import { Sparkles, Plus, Clock, Repeat, Tag } from 'lucide-react';
import { Reminder } from '../types.ts';

interface QuickAddBarProps {
  onAdd: (reminder: Partial<Reminder>) => void;
}

export const QuickAddBar: React.FC<QuickAddBarProps> = ({ onAdd }) => {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const parsed = input.trim().length > 2 ? parseNaturalReminder(input) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !parsed) return;

    onAdd({
      title: parsed.title,
      dueDate: parsed.dueDate,
      category: parsed.category,
      priority: parsed.priority,
      recurrence: parsed.recurrence,
      advanceNoticeMinutes: 0
    });

    setInput('');
  };

  const dueTimeStr = parsed
    ? new Date(parsed.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={`flex items-center gap-3 rounded-2xl border bg-slate-900/90 px-4 py-3 shadow-lg transition-all ${
            isFocused
              ? 'border-amber-400/80 shadow-amber-500/10 ring-1 ring-amber-400/50'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder="Quick add: &quot;Meeting with team tomorrow at 3pm&quot;, &quot;Gym at 6pm&quot;, &quot;Pay bills Friday&quot;..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg disabled:opacity-40 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span className="hidden sm:inline">Add Task</span>
          </button>
        </div>

        {/* Live Natural Language Parsing Preview */}
        {parsed && input.trim().length > 3 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-[#0f172a]/95 px-3 py-2 text-xs text-slate-300 shadow-xl backdrop-blur-md">
            <span className="text-amber-400 font-medium">Smart Parse:</span>
            <span className="font-semibold text-white truncate max-w-xs">{parsed.title}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="flex items-center gap-1 text-sky-400 font-mono">
              <Clock className="w-3 h-3" />
              <span>{dueTimeStr}</span>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="flex items-center gap-1 text-slate-400 capitalize">
              <Tag className="w-3 h-3 text-slate-500" />
              <span>{parsed.category}</span>
            </span>
            {parsed.recurrence !== 'none' && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="flex items-center gap-1 text-amber-300 capitalize font-mono">
                  <Repeat className="w-3 h-3" />
                  <span>{parsed.recurrence}</span>
                </span>
              </>
            )}
          </div>
        )}
      </form>
    </div>
  );
};
