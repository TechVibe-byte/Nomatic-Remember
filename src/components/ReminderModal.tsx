import React, { useState, useEffect } from 'react';
import { Reminder, Priority, RecurrenceType } from '../types.ts';
import { CATEGORIES } from '../utils/categories.ts';
import { X, Calendar, Clock, Repeat, Bell, Flag, Send } from 'lucide-react';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Reminder>) => void;
  initialData?: Reminder | null;
  telegramConfigured: boolean;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  telegramConfigured
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('work');
  const [priority, setPriority] = useState<Priority>('p2');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [advanceNoticeMinutes, setAdvanceNoticeMinutes] = useState(0);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setCategory(initialData.category);
      setPriority(initialData.priority);
      const d = new Date(initialData.dueDate);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      setDueDate(`${yyyy}-${mm}-${dd}`);
      setDueTime(`${hh}:${min}`);
      setRecurrence(initialData.recurrence);
      setAdvanceNoticeMinutes(initialData.advanceNoticeMinutes || 0);
    } else {
      // Default to next upcoming clean hour from now
      const now = new Date();
      const target = new Date(now);
      target.setMinutes(0, 0, 0);
      target.setHours(target.getHours() + 1);

      const yyyy = target.getFullYear();
      const mm = String(target.getMonth() + 1).padStart(2, '0');
      const dd = String(target.getDate()).padStart(2, '0');
      const hh = String(target.getHours()).padStart(2, '0');
      const min = String(target.getMinutes()).padStart(2, '0');

      setTitle('');
      setDescription('');
      setCategory('work');
      setPriority('p2');
      setDueDate(`${yyyy}-${mm}-${dd}`);
      setDueTime(`${hh}:${min}`);
      setRecurrence('none');
      setAdvanceNoticeMinutes(0);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Combine date and time in local timezone
    const [hh, mm] = dueTime.split(':').map(Number);
    const [year, month, day] = dueDate.split('-').map(Number);
    const combined = new Date(year, (month || 1) - 1, day || 1, hh || 0, mm || 0, 0, 0);

    onSave({
      ...(initialData ? { id: initialData.id } : {}),
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      dueDate: combined.toISOString(),
      advanceNoticeMinutes,
      recurrence
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-800 bg-[#0f172a] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">
              {initialData ? 'Edit Reminder' : 'Create New Reminder'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Going to office, Team sync, Pay electricity bill..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Notes & Checklist (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add key details, links, or instructions..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Date & Time Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Date</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white font-mono focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Exact Time</span>
              </label>
              <input
                type="time"
                required
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white font-mono focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Quick Time Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 mr-1">Presets:</span>
            {[
              { label: '9:00 AM', time: '09:00' },
              { label: '12:00 PM', time: '12:00' },
              { label: '3:00 PM', time: '15:00' },
              { label: '6:00 PM', time: '18:00' },
              { label: '8:00 PM', time: '20:00' }
            ].map(p => (
              <button
                type="button"
                key={p.time}
                onClick={() => setDueTime(p.time)}
                className={`px-2.5 py-1 text-xs rounded-lg border font-mono transition-colors ${
                  dueTime === p.time
                    ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                    : 'border-slate-800 bg-slate-850 text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Category Tag
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => {
                const isSelected = category.toLowerCase() === cat.id.toLowerCase();
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400/20 text-white font-semibold'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority Segmented Button */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5 text-amber-400" />
              <span>Priority Level</span>
            </label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
              {[
                { id: 'p1', label: 'P1 High', color: 'text-red-400' },
                { id: 'p2', label: 'P2 Med', color: 'text-amber-400' },
                { id: 'p3', label: 'P3 Normal', color: 'text-emerald-400' },
                { id: 'p4', label: 'P4 Low', color: 'text-slate-400' },
              ].map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPriority(p.id as Priority)}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                    priority === p.id
                      ? 'bg-slate-800 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className={priority === p.id ? p.color : ''}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recurrence & Deadline Alerts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-amber-400" />
                <span>Repeat Schedule</span>
              </label>
              <select
                value={recurrence}
                onChange={e => setRecurrence(e.target.value as RecurrenceType)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="none">One-time only</option>
                <option value="daily">Daily (Every day)</option>
                <option value="weekdays">Weekdays (Mon - Fri)</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 Weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span>Early Warning Alert</span>
              </label>
              <select
                value={advanceNoticeMinutes}
                onChange={e => setAdvanceNoticeMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none font-mono"
              >
                <option value={0}>Exact time (0 min)</option>
                <option value={5}>5 minutes before</option>
                <option value={15}>15 minutes before</option>
                <option value={30}>30 minutes before</option>
                <option value={60}>1 hour before</option>
                <option value={1440}>1 day before</option>
              </select>
            </div>
          </div>

          {/* Telegram Auto-alert indicator */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                {telegramConfigured
                  ? 'Telegram notifications enabled: exact alert sent to your Telegram!'
                  : 'Configure Telegram Hub to get mobile notifications without opening app.'}
              </span>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              {initialData ? 'Update Reminder' : 'Set Exact Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
