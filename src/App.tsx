import { useState, useEffect, useCallback, useMemo } from 'react';
import { Reminder, TelegramConfig, RollbackPoint, TelegramLog, SystemStatus } from './types.ts';
import { Navbar } from './components/Navbar.tsx';
import { ReminderCard } from './components/ReminderCard.tsx';
import { ReminderModal } from './components/ReminderModal.tsx';
import { TelegramDrawer } from './components/TelegramDrawer.tsx';
import { QuickAddBar } from './components/QuickAddBar.tsx';
import { MobileBottomNav } from './components/MobileBottomNav.tsx';
import { NotificationBanner } from './components/NotificationBanner.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { ChangelogView } from './components/ChangelogView.tsx';
import { playReminderChime } from './utils/audio.ts';
import { CATEGORIES, getCategoryBadgeClasses } from './utils/categories.ts';
import {
  Search,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  Sparkles,
  Inbox,
  Calendar,
  Key,
  X,
  ExternalLink
} from 'lucide-react';

export default function App() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    botToken: '',
    chatId: '',
    enabled: true,
    notificationsEnabled: true,
    autoBackupEnabled: true
  });
  const [rollbacks, setRollbacks] = useState<RollbackPoint[]>([]);
  const [logs, setLogs] = useState<TelegramLog[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);

  const [currentView, setCurrentView] = useState<'tasks' | 'today' | 'upcoming' | 'telegram' | 'rollbacks'>('tasks');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Banners
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [activeAlert, setActiveAlert] = useState<Reminder | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');

  // Quick Add Telegram Key Modal state
  const [isAddKeyModalOpen, setIsAddKeyModalOpen] = useState(false);
  const [quickBotToken, setQuickBotToken] = useState('');
  const [quickChatId, setQuickChatId] = useState('');
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Load initial notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission('unsupported');
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
        if (perm === 'granted') {
          playReminderChime();
          new Notification('Nomatic Remember', {
            body: 'Push notifications activated! You will receive exact-time alerts.',
            icon: '/favicon.ico'
          });
        }
      } catch (err) {
        console.warn('Notification permission error:', err);
      }
    }
  };

  // Fetch reminders and status
  const fetchAllData = useCallback(async () => {
    try {
      const [remRes, cfgRes, rbRes, logRes, statRes] = await Promise.all([
        fetch('/api/reminders'),
        fetch('/api/telegram/config'),
        fetch('/api/telegram/rollbacks'),
        fetch('/api/telegram/logs'),
        fetch('/api/status')
      ]);

      if (remRes.ok) {
        const rems: Reminder[] = await remRes.json();
        setReminders(rems);

        // Check if any reminder triggered now for client-side audio alert
        const now = Date.now();
        for (const r of rems) {
          if (!r.completed) {
            const due = new Date(r.dueDate).getTime();
            // within past 15 seconds and unnotified
            if (now >= due && now - due < 30000 && !r.notified) {
              setActiveAlert(r);
              playReminderChime();
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(`Reminder: ${r.title}`, {
                  body: `${r.description || 'Time to take action!'} (Due: ${new Date(r.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
                  icon: '/favicon.ico'
                });
              }
            }
          }
        }
      }

      if (cfgRes.ok) setTelegramConfig(await cfgRes.json());
      if (rbRes.ok) setRollbacks(await rbRes.json());
      if (logRes.ok) setLogs(await logRes.json());
      if (statRes.ok) setStatus(await statRes.json());
    } catch (e) {
      console.error('Failed to sync data from backend:', e);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 8000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // Actions
  const handleToggle = async (id: string) => {
    try {
      const res = await fetch(`/api/reminders/${id}/toggle`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setReminders(prev => prev.map(r => (r.id === id ? updated : r)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setReminders(prev => prev.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSnooze = async (id: string, minutes: number) => {
    try {
      const res = await fetch(`/api/reminders/${id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      });
      if (res.ok) {
        fetchAllData();
        if (activeAlert?.id === id) setActiveAlert(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveReminder = async (data: Partial<Reminder>) => {
    try {
      if (data.id) {
        // Update
        const res = await fetch(`/api/reminders/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) fetchAllData();
      } else {
        // Create
        const res = await fetch('/api/reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTelegramConfig = async (cfg: Partial<TelegramConfig>): Promise<boolean> => {
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg)
      });
      if (res.ok) {
        fetchAllData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleQuickSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickBotToken.trim()) return;
    setIsVerifyingKey(true);
    setKeyError(null);
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: quickBotToken.trim(),
          ...(quickChatId.trim() ? { chatId: quickChatId.trim() } : {})
        })
      });
      const data = await res.json();
      setIsVerifyingKey(false);
      if (res.ok && data.isVerified) {
        fetchAllData();
        setIsAddKeyModalOpen(false);
        setQuickBotToken('');
        setQuickChatId('');
      } else {
        setKeyError(data.verificationError || 'Verification failed. Please check your token from @BotFather.');
      }
    } catch (e: unknown) {
      setIsVerifyingKey(false);
      setKeyError(e instanceof Error ? e.message : 'Network error verifying key');
    }
  };

  const handleTestMessage = async (customChatId?: string) => {
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testChatId: customChatId })
      });
      return await res.json();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, error: message };
    }
  };

  const handleBackup = async (label?: string) => {
    try {
      const res = await fetch('/api/telegram/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, triggeredBy: 'manual' })
      });
      const data = await res.json();
      fetchAllData();
      return data;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, message };
    }
  };

  const handleRollback = async (id: string) => {
    try {
      const res = await fetch(`/api/telegram/rollback/${id}`, { method: 'POST' });
      const data = await res.json();
      fetchAllData();
      return data;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, message };
    }
  };

  const handleRestoreJson = async (jsonContent: string) => {
    try {
      const res = await fetch('/api/telegram/restore-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonContent })
      });
      return await res.json();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, message };
    }
  };

  const handleSimulateMessage = async (text: string) => {
    const res = await fetch('/api/telegram/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    return await res.json();
  };

  const handleSendTelegramImmediate = async (reminder: Reminder) => {
    const timeFormatted = new Date(reminder.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const text = `🔔 *Manual Reminder Test Ping*\n📌 *${reminder.title}*\n🕒 Scheduled: ${timeFormatted}\n🏷️ Category: ${reminder.category}`;
    await fetch('/api/telegram/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    fetchAllData();
  };

  // Filtered Reminders List
  const filteredReminders = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();

    return reminders.filter(r => {
      // View filtering
      if (currentView === 'today') {
        const d = new Date(r.dueDate).toDateString();
        if (d !== todayStr) return false;
      } else if (currentView === 'upcoming') {
        const d = new Date(r.dueDate);
        if (d.getTime() <= now.getTime()) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && r.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // Priority filter
      if (selectedPriority !== 'all' && r.priority !== selectedPriority) {
        return false;
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesDesc = r.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }

      return true;
    });
  }, [reminders, currentView, selectedCategory, selectedPriority, searchQuery]);

  // Counts
  const pendingReminders = useMemo(() => filteredReminders.filter(r => !r.completed), [filteredReminders]);
  const completedReminders = useMemo(() => filteredReminders.filter(r => r.completed), [filteredReminders]);

  const isTelegramConfigured = Boolean(
    (telegramConfig.hasToken || Boolean(telegramConfig.botToken)) &&
    telegramConfig.isVerified === true
  );
  const hasTelegramKey = Boolean(telegramConfig.hasToken || Boolean(telegramConfig.botToken));

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans pb-20 md:pb-12">
      {/* Top Bar Navigation */}
      <Navbar
        currentView={currentView}
        onSelectView={setCurrentView}
        onOpenNewModal={() => {
          setEditingReminder(null);
          setIsModalOpen(true);
        }}
        telegramConnected={isTelegramConfigured}
        onRequestNotificationPermission={requestNotificationPermission}
        notificationPermission={notificationPermission}
      />

      {/* Floating In-App Reminder Alert Banner */}
      <NotificationBanner
        activeNotification={activeAlert}
        onDismiss={() => setActiveAlert(null)}
        onMarkDone={id => {
          handleToggle(id);
          setActiveAlert(null);
        }}
        onSnooze={handleSnooze}
      />

      {/* Main Workspace Viewport */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {/* Metric Cards Row */}
        <section className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Reminders</span>
              <div className="mt-1 text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
                {status?.activeReminders ?? pendingReminders.length}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Due Today</span>
              <div className="mt-1 text-2xl font-bold tracking-tight text-amber-400 font-mono tabular-nums">
                {status?.todayCount ?? 0}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Calendar className="w-5 h-5 text-amber-400" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm flex items-center justify-between">
            <div className="flex-1 min-w-0 mr-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Telegram Link</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {isTelegramConfigured ? (
                  <>
                    <button
                      onClick={() => setCurrentView('telegram')}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 text-xs font-semibold cursor-pointer truncate"
                      title="Telegram Bot Connected - Click to view details"
                    >
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Connected (@{telegramConfig.botUsername || 'Bot'})</span>
                    </button>
                    <button
                      onClick={() => {
                        setKeyError(null);
                        setIsAddKeyModalOpen(true);
                      }}
                      className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                      title="Update or change Bot API Key"
                    >
                      Change Key
                    </button>
                  </>
                ) : hasTelegramKey && telegramConfig.isVerified === false ? (
                  <>
                    <span className="text-rose-400 flex items-center gap-1.5 text-xs font-semibold">
                      <span className="h-2 w-2 rounded-full bg-rose-500 inline-block shrink-0"></span>
                      <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>Not Connected</span>
                    </span>
                    <button
                      onClick={() => {
                        setKeyError(null);
                        setIsAddKeyModalOpen(true);
                      }}
                      className="px-2 py-0.5 text-[11px] font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-md transition-colors cursor-pointer"
                    >
                      Fix Key
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-rose-400 flex items-center gap-1.5 text-xs font-medium">
                      <span className="h-2 w-2 rounded-full bg-rose-500 inline-block shrink-0"></span>
                      <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>Not Connected</span>
                    </span>
                    <button
                      onClick={() => {
                        setKeyError(null);
                        setIsAddKeyModalOpen(true);
                      }}
                      className="px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-md transition-colors cursor-pointer shadow-sm"
                    >
                      + Add Key
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isTelegramConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              <Send className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setCurrentView('rollbacks')}
            className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm flex items-center justify-between cursor-pointer hover:border-slate-700 transition-colors"
            title="View Change Log & Checkpoints"
          >
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Change Checkpoints</span>
              <div className="mt-1 text-2xl font-bold tracking-tight text-emerald-400 font-mono tabular-nums">
                {rollbacks.length}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Content routing based on currentView */}
        {currentView === 'telegram' ? (
          <TelegramDrawer
            config={telegramConfig}
            rollbacks={rollbacks}
            logs={logs}
            reminders={reminders}
            onSaveConfig={handleSaveTelegramConfig}
            onTestMessage={handleTestMessage}
            onBackup={handleBackup}
            onRollback={handleRollback}
            onRestoreJson={handleRestoreJson}
            onSimulateMessage={handleSimulateMessage}
            onRefresh={fetchAllData}
          />
        ) : currentView === 'rollbacks' ? (
          <ChangelogView
            rollbacks={rollbacks}
            logs={logs}
            currentReminders={reminders}
            onRollback={handleRollback}
            onBackup={handleBackup}
            onRefresh={fetchAllData}
          />
        ) : (
          /* Tasks View: All / Today / Upcoming */
          <div className="space-y-6">
            {/* Quick Add Bar with Natural Language Parsing */}
            <QuickAddBar onAdd={handleSaveReminder} />

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Category Segmented Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  All ({reminders.length})
                </button>
                {CATEGORIES.map(cat => {
                  const count = reminders.filter(r => r.category.toLowerCase() === cat.id.toLowerCase()).length;
                  const isSelected = selectedCategory.toLowerCase() === cat.id.toLowerCase();
                  const badge = getCategoryBadgeClasses(cat.color);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-slate-950' : badge.dot}`} />
                      <span>{cat.name}</span>
                      <span className={`text-[10px] font-mono ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search & Priority Selector */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <select
                  value={selectedPriority}
                  onChange={e => setSelectedPriority(e.target.value)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:border-amber-400 focus:outline-none font-mono"
                >
                  <option value="all">All Priorities</option>
                  <option value="p1">P1 High</option>
                  <option value="p2">P2 Med</option>
                  <option value="p3">P3 Normal</option>
                  <option value="p4">P4 Low</option>
                </select>
              </div>
            </div>

            {/* List of Tasks */}
            {filteredReminders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
                <Inbox className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-300">No reminders found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchQuery || selectedCategory !== 'all'
                    ? 'Try clearing your filters or search term to see more reminders.'
                    : 'Create your first reminder above, or send a reminder command to the Telegram Bot!'}
                </p>
                <button
                  onClick={() => {
                    setEditingReminder(null);
                    setIsModalOpen(true);
                  }}
                  className="mt-4 px-4 py-2 text-xs font-semibold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300 transition-colors"
                >
                  + Add Reminder
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Active / Pending Section */}
                {pendingReminders.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2">
                      <span className="font-semibold uppercase tracking-wider text-slate-300">
                        Pending Reminders ({pendingReminders.length})
                      </span>
                      <span className="text-[11px] font-mono">Sorted by deadline</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {pendingReminders.map(reminder => (
                        <ReminderCard
                          key={reminder.id}
                          reminder={reminder}
                          onToggle={handleToggle}
                          onEdit={r => {
                            setEditingReminder(r);
                            setIsModalOpen(true);
                          }}
                          onDelete={handleDelete}
                          onSnooze={handleSnooze}
                          onSendTelegramImmediate={handleSendTelegramImmediate}
                          telegramConfigured={isTelegramConfigured}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Section */}
                {completedReminders.length > 0 && (
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-800/80 pb-2">
                      <span className="font-semibold uppercase tracking-wider">
                        Completed ({completedReminders.length})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {completedReminders.map(reminder => (
                        <ReminderCard
                          key={reminder.id}
                          reminder={reminder}
                          onToggle={handleToggle}
                          onEdit={r => {
                            setEditingReminder(r);
                            setIsModalOpen(true);
                          }}
                          onDelete={handleDelete}
                          onSnooze={handleSnooze}
                          onSendTelegramImmediate={handleSendTelegramImmediate}
                          telegramConfigured={isTelegramConfigured}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create / Edit Modal */}
      <ReminderModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingReminder(null);
        }}
        onSave={handleSaveReminder}
        initialData={editingReminder}
        telegramConfigured={isTelegramConfigured}
      />

      {/* Quick Add Telegram Key Modal */}
      {isAddKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Add Telegram Bot Key</h3>
                  <p className="text-[11px] text-slate-400">Connect your bot for real-time reminder alerts</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddKeyModalOpen(false);
                  setKeyError(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickSaveKey} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Telegram Bot API Token <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={quickBotToken}
                  onChange={e => setQuickBotToken(e.target.value)}
                  placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  autoFocus
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <p className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
                  <span>Get your token by messaging</span>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 hover:underline font-mono inline-flex items-center gap-0.5"
                  >
                    @BotFather <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Chat ID <span className="text-slate-500 text-[10px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={quickChatId}
                  onChange={e => setQuickChatId(e.target.value)}
                  placeholder="e.g. 987654321 (auto-detected when you /start bot)"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {keyError && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl border border-rose-500/30 bg-rose-950/40 text-rose-300 text-xs">
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{keyError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddKeyModalOpen(false);
                    setKeyError(null);
                  }}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingKey || !quickBotToken.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-xl hover:bg-emerald-300 disabled:opacity-50 transition-all cursor-pointer shadow-md"
                >
                  {isVerifyingKey ? (
                    <>
                      <span className="w-3 h-3 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></span>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verify & Connect Key</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentView={currentView}
        onSelectView={setCurrentView}
        onOpenNewModal={() => {
          setEditingReminder(null);
          setIsModalOpen(true);
        }}
      />

      {/* Offline Status Toast */}
      <OfflineIndicator />
    </div>
  );
}
