import React, { useState, useMemo } from 'react';
import { RollbackPoint, TelegramLog, Reminder } from '../types.ts';
import {
  RotateCcw,
  ShieldCheck,
  Terminal,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  ArrowDownToLine,
  Eye,
  X,
  RefreshCw,
  Plus,
  GitBranch,
  Calendar,
  Layers,
  Sparkles,
  Smartphone,
  ChevronRight
} from 'lucide-react';

interface ChangelogViewProps {
  rollbacks: RollbackPoint[];
  logs: TelegramLog[];
  currentReminders: Reminder[];
  onRollback: (id: string) => Promise<{ success: boolean; message?: string }>;
  onBackup: (label?: string) => Promise<{ success: boolean; rollbackPoint?: RollbackPoint; message?: string }>;
  onRefresh: () => void;
}

type TabType = 'audit' | 'rollbacks' | 'releases';

export const ChangelogView: React.FC<ChangelogViewProps> = ({
  rollbacks,
  logs,
  currentReminders,
  onRollback,
  onBackup,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('audit');
  const [logSearch, setLogSearch] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'reminder_sent' | 'bot_received' | 'backup' | 'error'>('all');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [newBackupLabel, setNewBackupLabel] = useState('');
  const [isSubmittingBackup, setIsSubmittingBackup] = useState(false);

  // Inspection modal state for viewing tasks inside a rollback point
  const [inspectingRollback, setInspectingRollback] = useState<RollbackPoint | null>(null);
  const [confirmRollbackId, setConfirmRollbackId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleCreateCustomBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingBackup) return;
    setIsSubmittingBackup(true);
    const label = newBackupLabel.trim() || `Manual Checkpoint (${currentReminders.length} tasks)`;
    const result = await onBackup(label);
    setIsSubmittingBackup(false);
    setIsCreatingBackup(false);
    setNewBackupLabel('');
    if (result.success) {
      showNotice(`Checkpoint "${label}" successfully created!`);
    } else {
      showNotice(result.message || 'Failed to create checkpoint');
    }
  };

  const handleExecuteRestore = async (id: string) => {
    const result = await onRollback(id);
    setConfirmRollbackId(null);
    setInspectingRollback(null);
    if (result.success) {
      showNotice('Rollback applied successfully! Schedule restored.');
    } else {
      showNotice(result.message || 'Rollback failed');
    }
  };

  const handleDownloadSnapshotJson = (rb: RollbackPoint) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rb.dataSnapshot, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `nomatic-checkpoint-${rb.id}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showNotice('Downloaded snapshot JSON export');
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Type filter
      if (logFilter === 'reminder_sent' && log.type !== 'reminder_sent') return false;
      if (logFilter === 'bot_received' && log.type !== 'bot_received') return false;
      if (logFilter === 'backup' && !['backup_sent', 'rollback_restored', 'sync'].includes(log.type)) return false;
      if (logFilter === 'error' && log.type !== 'error') return false;

      // Text search
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase();
        const matchesMsg = log.message.toLowerCase().includes(q);
        const matchesType = log.type.toLowerCase().includes(q);
        const matchesChat = log.chatId?.toLowerCase().includes(q);
        if (!matchesMsg && !matchesType && !matchesChat) return false;
      }

      return true;
    });
  }, [logs, logFilter, logSearch]);

  const releaseNotes = [
    {
      version: 'v1.3.0',
      date: 'September 2026',
      badge: 'Latest',
      title: 'PWA Mobile App & Dynamic Hour Engine',
      description: 'Full Progressive Web App capability with offline asset caching and improved schedule ergonomics.',
      highlights: [
        'Added PWA Manifest with standalone display mode and offline service worker caching',
        'Mobile home-screen installation on iOS, Android, and Desktop with one-tap prompt',
        'Full suite of custom adaptive icons including 15% safe-zone maskable assets',
        'Dynamic next-clean-hour default time for new reminders instead of fixed 7 AM',
        'Real-time offline mode status indicator toast'
      ]
    },
    {
      version: 'v1.2.0',
      date: 'September 2026',
      badge: 'Major',
      title: 'Telegram Bot Sync & Exact-Time Cron',
      description: 'Zero-latency bidirectional Telegram synchronization with live simulator and remote commands.',
      highlights: [
        'Two-way Telegram bot commands: /remind, /list, /done, /backup, and /rollback',
        'Direct server-side Telegram API webhook receiver & polling fallback',
        'In-app terminal simulator to test bot conversations without leaving the browser',
        'Vercel cron deployment guide for 24/7 background notification dispatches'
      ]
    },
    {
      version: 'v1.1.0',
      date: 'August 2026',
      badge: 'Feature',
      title: 'Smart NLP Parser & Category Engine',
      description: 'Intelligent natural language parser that automatically extracts dates, clean times, and tags.',
      highlights: [
        'Natural speech quick-add (e.g. "Gym tomorrow at 6pm", "Team sync in 2 hours")',
        'Categorization for Work, Personal, Finance, Health, and Urgent priorities (P1-P4)',
        'Advance notice alarms (5m, 15m, 30m, 1h, 1d ahead of target deadlines)',
        'Synthesized audio chime sound alerts with browser Notification API integration'
      ]
    },
    {
      version: 'v1.0.0',
      date: 'August 2026',
      badge: 'Initial',
      title: 'Core Reminder & Snapshot Architecture',
      description: 'Initial release of Nomatic Remember with persistent storage, immutable snapshots, and clean dark UI.',
      highlights: [
        'Single-file persistent storage with zero external database dependencies',
        'Point-in-time snapshot creation with atomic rollback recovery',
        'Cross-platform responsive dark theme built with Tailwind CSS'
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-950/90 px-4 py-2.5 text-xs text-emerald-200 shadow-xl backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Changelog & Activity History
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>{logs.length} audit events logged</span>
                <span aria-hidden="true">·</span>
                <span>{rollbacks.length} rollback snapshots</span>
                <span aria-hidden="true">·</span>
                <span>v1.3.0 PWA</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={onRefresh}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-750 border border-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Refresh logs & snapshots"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsCreatingBackup(true)}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-xl hover:bg-emerald-300 transition-all cursor-pointer shadow-md shadow-emerald-950/40"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Checkpoint</span>
          </button>
        </div>
      </div>

      {/* Navigation Segmented Control */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/80 border border-slate-800/80 rounded-xl">
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Audit & Dispatch Logs</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
            activeTab === 'audit' ? 'bg-amber-500/30 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
          }`}>
            {logs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('rollbacks')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'rollbacks'
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Rollback Checkpoints</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
            activeTab === 'rollbacks' ? 'bg-amber-500/30 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
          }`}>
            {rollbacks.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('releases')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'releases'
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Release Notes</span>
        </button>
      </div>

      {/* TAB 1: AUDIT & DISPATCH LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                placeholder="Search events, chat IDs, or dispatch errors..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              {logSearch && (
                <button
                  onClick={() => setLogSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Type Filters */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'reminder_sent', label: 'Dispatches' },
                  { id: 'bot_received', label: 'Bot Inputs' },
                  { id: 'backup', label: 'Backups' },
                  { id: 'error', label: 'Errors' }
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setLogFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                    logFilter === tab.id
                      ? 'bg-slate-700 text-white font-medium'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Log Stream */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-sm">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-3">
                <Terminal className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-sm font-medium text-slate-300">No activity events found</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {logSearch || logFilter !== 'all'
                    ? 'No log entries match your current search criteria.'
                    : 'System activity, Telegram message deliveries, backups, and error logs will appear here automatically in real time.'}
                </p>
                <button
                  onClick={() => onBackup('Initial state checkpoint')}
                  className="mt-2 px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-xl hover:bg-amber-400/20 transition-colors"
                >
                  Generate First Checkpoint
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {filteredLogs.map(log => {
                  const date = new Date(log.timestamp);
                  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

                  let icon = <Clock className="w-4 h-4 text-slate-400" />;
                  let typeLabel = 'System';
                  let typeColor = 'text-slate-400';

                  if (log.type === 'reminder_sent') {
                    icon = <Send className="w-4 h-4 text-sky-400" />;
                    typeLabel = 'Reminder Sent';
                    typeColor = 'text-sky-400';
                  } else if (log.type === 'bot_received') {
                    icon = <Terminal className="w-4 h-4 text-emerald-400" />;
                    typeLabel = 'Bot Command';
                    typeColor = 'text-emerald-400';
                  } else if (log.type === 'backup_sent') {
                    icon = <ShieldCheck className="w-4 h-4 text-purple-400" />;
                    typeLabel = 'Backup Created';
                    typeColor = 'text-purple-400';
                  } else if (log.type === 'rollback_restored') {
                    icon = <RotateCcw className="w-4 h-4 text-amber-400" />;
                    typeLabel = 'Rollback Restored';
                    typeColor = 'text-amber-400';
                  } else if (log.type === 'error') {
                    icon = <AlertTriangle className="w-4 h-4 text-rose-400" />;
                    typeLabel = 'Error';
                    typeColor = 'text-rose-400';
                  } else if (log.type === 'sync') {
                    icon = <Sparkles className="w-4 h-4 text-indigo-400" />;
                    typeLabel = 'State Sync';
                    typeColor = 'text-indigo-400';
                  }

                  return (
                    <div
                      key={log.id}
                      className="p-4 hover:bg-slate-850/50 transition-colors flex items-start gap-3.5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 border border-slate-800 mt-0.5">
                        {icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <span className={`font-semibold ${typeColor}`}>{typeLabel}</span>
                          <span className="text-slate-600" aria-hidden="true">·</span>
                          <span className="text-slate-400 font-mono text-[11px]">{dateStr} {timeStr}</span>
                          {log.chatId && (
                            <>
                              <span className="text-slate-600" aria-hidden="true">·</span>
                              <span className="text-slate-500 font-mono text-[11px]">Chat: {log.chatId}</span>
                            </>
                          )}
                          <span className="text-slate-600" aria-hidden="true">·</span>
                          <span className={log.success ? 'text-emerald-400' : 'text-rose-400'}>
                            {log.success ? 'Success' : 'Failed'}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-200 font-mono break-words leading-relaxed">
                          {log.message}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ROLLBACK CHECKPOINTS */}
      {activeTab === 'rollbacks' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-emerald-400" />
                <span>Immutable Checkpoint Snapshots</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Every snapshot freezes your entire task schedule at a specific moment. Rollback restores tasks instantly with zero data loss.
              </p>
            </div>
            <button
              onClick={() => setIsCreatingBackup(true)}
              className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-xl hover:bg-emerald-300 transition-all cursor-pointer shadow-md"
            >
              + Create Checkpoint
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
            {rollbacks.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-3">
                <RotateCcw className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-sm font-medium text-slate-300">No checkpoints recorded yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click below to capture your current schedule and active tasks as your baseline rollback point.
                </p>
                <button
                  onClick={() => onBackup('Baseline snapshot')}
                  className="mt-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 rounded-xl hover:bg-emerald-300 transition-colors shadow-md"
                >
                  Create Baseline Checkpoint
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {rollbacks.map(rb => {
                  const date = new Date(rb.timestamp);
                  const isCurrent = confirmRollbackId === rb.id;

                  return (
                    <div
                      key={rb.id}
                      className="p-5 hover:bg-slate-850/40 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-bold text-white">{rb.label}</span>
                          <span className="text-xs text-emerald-400 font-mono">
                            {rb.reminderCount} tasks preserved
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                          <span>{date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span aria-hidden="true">·</span>
                          <span>Trigger: {rb.triggeredBy}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-600">ID: {rb.id}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                          onClick={() => setInspectingRollback(rb)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-750 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
                          title="Inspect tasks in this checkpoint"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span>Inspect</span>
                        </button>

                        <button
                          onClick={() => handleDownloadSnapshotJson(rb)}
                          className="p-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                          title="Download JSON export"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                        </button>

                        {isCurrent ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleExecuteRestore(rb.id)}
                              className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors cursor-pointer shadow-md"
                            >
                              Confirm Rollback
                            </button>
                            <button
                              onClick={() => setConfirmRollbackId(null)}
                              className="px-2 py-1.5 text-xs text-slate-400 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRollbackId(rb.id)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/50 border border-emerald-800/80 hover:bg-emerald-900/50 rounded-xl transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Rollback</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: APP RELEASE NOTES (PRODUCT CHANGELOG) */}
      {activeTab === 'releases' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Product Changelog & Updates</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Documenting key architectural iterations, mobile enhancements, and feature additions for Nomatic Remember.
            </p>
          </div>

          <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {releaseNotes.map((rel, idx) => (
              <div key={rel.version} className="relative">
                {/* Timeline node */}
                <div className={`absolute -left-6 top-1 h-4 w-4 rounded-full border-2 ${
                  idx === 0
                    ? 'border-amber-400 bg-slate-950 shadow-sm shadow-amber-500/50'
                    : 'border-slate-700 bg-slate-900'
                }`} />

                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-white font-mono">{rel.version}</span>
                      <span className="text-xs text-slate-400">{rel.date}</span>
                    </div>
                    <span className="text-xs font-semibold text-amber-300">
                      {rel.title}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {rel.description}
                  </p>

                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Key Improvements:</span>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {rel.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE CHECKPOINT MODAL */}
      {isCreatingBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Create Snapshot Checkpoint</h3>
              </div>
              <button
                onClick={() => setIsCreatingBackup(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomBackup} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Checkpoint Name / Note:
                </label>
                <input
                  type="text"
                  value={newBackupLabel}
                  onChange={e => setNewBackupLabel(e.target.value)}
                  placeholder={`e.g. "Before clearing completed" or "Weekly review"`}
                  autoFocus
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Current Active Reminders:</span>
                  <strong className="text-white font-mono">{currentReminders.length}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Timestamp:</span>
                  <span className="font-mono text-slate-300">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingBackup(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBackup}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-xl hover:bg-emerald-300 disabled:opacity-50 transition-all cursor-pointer shadow-md"
                >
                  {isSubmittingBackup ? 'Saving...' : 'Save Checkpoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT CHECKPOINT MODAL */}
      {inspectingRollback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>{inspectingRollback.label}</span>
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                  <span>{new Date(inspectingRollback.timestamp).toLocaleString()}</span>
                  <span aria-hidden="true">·</span>
                  <span>{inspectingRollback.dataSnapshot.length} tasks saved</span>
                </div>
              </div>
              <button
                onClick={() => setInspectingRollback(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
              {inspectingRollback.dataSnapshot.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  This checkpoint was saved with zero tasks.
                </p>
              ) : (
                inspectingRollback.dataSnapshot.map(task => {
                  const d = new Date(task.dueDate);
                  return (
                    <div
                      key={task.id}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-200 truncate">{task.title}</div>
                        <div className="text-slate-500 font-mono text-[11px] mt-0.5 flex items-center gap-2">
                          <span>{d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{task.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="uppercase">{task.priority}</span>
                        </div>
                      </div>
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                        task.completed ? 'bg-slate-800 text-slate-500 line-through' : 'bg-amber-400/10 text-amber-300'
                      }`}>
                        {task.completed ? 'Done' : 'Active'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
              <button
                onClick={() => handleDownloadSnapshotJson(inspectingRollback)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInspectingRollback(null)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={() => handleExecuteRestore(inspectingRollback.id)}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-colors cursor-pointer shadow-md"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Snapshot</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
