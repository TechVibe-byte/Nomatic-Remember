import React, { useState, useEffect } from 'react';
import { TelegramConfig, RollbackPoint, TelegramLog, Reminder } from '../types.ts';
import {
  Send,
  Save,
  RotateCcw,
  ShieldCheck,
  Terminal,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Download,
  Upload,
  CloudLightning,
  Sparkles
} from 'lucide-react';

interface TelegramDrawerProps {
  config: TelegramConfig;
  rollbacks: RollbackPoint[];
  logs: TelegramLog[];
  reminders: Reminder[];
  onSaveConfig: (cfg: Partial<TelegramConfig>) => Promise<boolean>;
  onTestMessage: (customChatId?: string) => Promise<{ success: boolean; error?: string }>;
  onBackup: (label?: string) => Promise<{ success: boolean; rollbackPoint?: RollbackPoint; message?: string }>;
  onRollback: (id: string) => Promise<{ success: boolean; message?: string }>;
  onRestoreJson: (json: string) => Promise<{ success: boolean; message?: string }>;
  onSimulateMessage: (text: string) => Promise<{ incoming: string; reply: string }>;
  onRefresh: () => void;
}

export const TelegramDrawer: React.FC<TelegramDrawerProps> = ({
  config,
  rollbacks,
  logs,
  reminders,
  onSaveConfig,
  onTestMessage,
  onBackup,
  onRollback,
  onRestoreJson,
  onSimulateMessage,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'simulator' | 'backups' | 'vercel'>('settings');

  // Form state
  const [botToken, setBotToken] = useState(config.botToken || '');
  const [chatId, setChatId] = useState(config.chatId || '');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{ ok: boolean; message: string } | null>(null);

  // Sync state if config updates from server
  useEffect(() => {
    if (config.botToken && !botToken) setBotToken(config.botToken);
    if (config.chatId && !chatId) setChatId(config.chatId);
  }, [config.botToken, config.chatId]);

  const handleVerifyToken = async () => {
    if (!botToken.trim()) {
      setVerifyStatus({ ok: false, message: 'Please enter a Bot Token from @BotFather first' });
      return;
    }
    setVerifying(true);
    setVerifyStatus(null);
    try {
      const res = await fetch('/api/telegram/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: botToken.trim() })
      });
      const data = await res.json();
      if (data.ok) {
        setVerifyStatus({ ok: true, message: `Valid bot token! Verified as @${data.username} (${data.firstName})` });
        onRefresh();
      } else {
        setVerifyStatus({ ok: false, message: data.error || 'Invalid Bot Token. Check @BotFather.' });
      }
    } catch {
      setVerifyStatus({ ok: false, message: 'Could not connect to Telegram servers' });
    } finally {
      setVerifying(false);
    }
  };

  // Backup & Rollback state
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [selectedRollback, setSelectedRollback] = useState<RollbackPoint | null>(null);
  const [restoreConfirming, setRestoreConfirming] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonModal, setShowJsonModal] = useState(false);

  // Simulator state
  const [simText, setSimText] = useState('');
  const [simHistory, setSimHistory] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([]);
  const [simLoading, setSimLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('Saving...');
    const ok = await onSaveConfig({ botToken, chatId, enabled: true });
    if (ok) {
      setSaveStatus('Settings updated successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
    } else {
      setSaveStatus('Failed to update settings');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await onTestMessage(chatId);
    setTesting(false);
    if (res.success) {
      setTestResult({ success: true, message: 'Alert delivered to Telegram successfully! Check your Telegram app.' });
    } else {
      setTestResult({ success: false, message: res.error || 'Failed to dispatch test message' });
    }
  };

  const handleTriggerBackup = async () => {
    setBackupLoading(true);
    setBackupSuccess(null);
    const res = await onBackup();
    setBackupLoading(false);
    if (res.success) {
      setBackupSuccess('Snapshot saved & Telegram backup notification dispatched!');
      setTimeout(() => setBackupSuccess(null), 4000);
    }
  };

  const handleExecuteRollback = async (id: string) => {
    const res = await onRollback(id);
    setRestoreConfirming(null);
    if (res.success) {
      onRefresh();
    }
  };

  const handleSendSim = async () => {
    if (!simText.trim()) return;
    const msg = simText.trim();
    setSimText('');
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setSimHistory(prev => [...prev, { sender: 'user', text: msg, time: nowTime }]);
    setSimLoading(true);

    try {
      const res = await onSimulateMessage(msg);
      setSimHistory(prev => [...prev, { sender: 'bot', text: res.reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      onRefresh();
    } catch {
      setSimHistory(prev => [...prev, { sender: 'bot', text: '❌ Failed to process message', time: nowTime }]);
    } finally {
      setSimLoading(false);
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reminders, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `nomatic_remember_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Segmented Tab Bar */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'settings'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Send className="w-3.5 h-3.5 text-sky-400" />
          <span>Bot Connection</span>
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'simulator'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-amber-400" />
          <span>Bot Simulator</span>
        </button>
        <button
          onClick={() => setActiveTab('backups')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'backups'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
          <span>Telegram Backup & Rollback</span>
        </button>
        <button
          onClick={() => setActiveTab('vercel')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'vercel'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CloudLightning className="w-3.5 h-3.5 text-indigo-400" />
          <span>Vercel Exact-Time Setup</span>
        </button>
      </div>

      {/* TAB 1: Bot Connection & Setup */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: 7 cols */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Telegram API Configuration</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Delivers exact-time deadline alerts directly to your Telegram app without needing web tab open.
                </p>
              </div>
              <span
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${
                  config.isVerified && config.chatId
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                    : config.hasToken && config.isVerified === false
                    ? 'bg-red-950/60 text-red-300 border-red-700/60'
                    : config.hasToken && !config.chatId
                    ? 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700'
                }`}
              >
                {config.isVerified && config.chatId ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Connected (@{config.botUsername || 'Bot'})</span>
                  </>
                ) : config.hasToken && config.isVerified === false ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    <span>Invalid API Key</span>
                  </>
                ) : config.hasToken && !config.chatId ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Missing Chat ID</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                    <span>Not Connected (No API Key)</span>
                  </>
                )}
              </span>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Telegram Bot Token *
                  </label>
                  <button
                    type="button"
                    disabled={verifying || !botToken.trim()}
                    onClick={handleVerifyToken}
                    className="text-[11px] text-amber-400 hover:text-amber-300 disabled:opacity-40 font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <span>{verifying ? 'Checking...' : 'Verify Token'}</span>
                  </button>
                </div>
                <input
                  type="password"
                  value={botToken}
                  onChange={e => setBotToken(e.target.value)}
                  placeholder="e.g. 7123456789:AAHk... from @BotFather"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:border-amber-400 focus:outline-none"
                />
                {verifyStatus && (
                  <div
                    className={`mt-1.5 text-[11px] font-medium ${
                      verifyStatus.ok ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {verifyStatus.message}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Your Telegram Chat ID *
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={e => setChatId(e.target.value)}
                  placeholder="e.g. 123456789 (your personal or group chat ID)"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:border-amber-400 focus:outline-none"
                />
              </div>

              {saveStatus && (
                <div className="text-xs text-emerald-400 font-medium">{saveStatus}</div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Telegram Credentials</span>
                </button>

                <button
                  type="button"
                  disabled={testing || !botToken}
                  onClick={handleTest}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-sky-300 bg-sky-950/60 border border-sky-800 hover:bg-sky-900/60 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{testing ? 'Sending Test...' : 'Send Live Test Alert'}</span>
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : 'bg-red-950/40 border-red-800/60 text-red-300'
                  }`}
                >
                  {testResult.message}
                </div>
              )}
            </form>

            {/* Telegram Webhook Details */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
              <span className="text-xs font-semibold text-slate-300">Live Webhook Endpoint</span>
              <p className="text-xs text-slate-400">
                To receive commands from Telegram when deployed, set this webhook on Telegram:
              </p>
              <div className="flex items-center justify-between bg-slate-900 rounded-lg p-2 font-mono text-[11px] text-amber-300 border border-slate-800">
                <span className="truncate">https://your-domain.com/api/telegram/webhook</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('https://your-domain.com/api/telegram/webhook');
                  }}
                  className="p-1 hover:text-white"
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Guide: 5 cols */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span>30-Second Bot Setup Guide</span>
            </h4>

            <ol className="space-y-3 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
              <li>
                Open Telegram and search for{' '}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 hover:underline font-mono inline-flex items-center gap-0.5"
                >
                  @BotFather <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Send <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">/newbot</code> and give your bot a name (e.g. <em>NomaticRememberBot</em>)
              </li>
              <li>
                Copy the HTTP API Token provided by BotFather and paste it into the field on the left.
              </li>
              <li>
                To get your Chat ID, search for{' '}
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 hover:underline font-mono inline-flex items-center gap-0.5"
                >
                  @userinfobot <ExternalLink className="w-3 h-3" />
                </a>{' '}
                or start your bot and check your ID.
              </li>
              <li>
                Click <strong>Save</strong> and <strong>Send Live Test Alert</strong> to verify!
              </li>
            </ol>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-1.5 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">Supported Telegram Bot Commands:</span>
              <ul className="space-y-1 font-mono text-[11px] text-slate-300">
                <li><span className="text-amber-400">/remind &lt;time&gt; &lt;task&gt;</span> - Set task reminder</li>
                <li><span className="text-amber-400">/list</span> - View all pending tasks</li>
                <li><span className="text-amber-400">/done &lt;id&gt;</span> - Mark task finished</li>
                <li><span className="text-amber-400">/backup</span> - Instant data backup snapshot</li>
                <li><span className="text-amber-400">/rollback</span> - Restore previous state</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Interactive Telegram Bot Simulator */}
      {activeTab === 'simulator' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                <span>Interactive Telegram Bot Simulator</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Test sending commands from Telegram to Nomatic Remember right here in your browser!
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSimText('/start')}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
              >
                /start
              </button>
              <button
                onClick={() => setSimText('/list')}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
              >
                /list
              </button>
              <button
                onClick={() => setSimText('/backup')}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
              >
                /backup
              </button>
            </div>
          </div>

          {/* Chat feed */}
          <div className="h-80 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3 font-sans">
            {simHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                <Terminal className="w-8 h-8 text-slate-600" />
                <p className="text-xs max-w-xs">
                  Type a command or reminder below (e.g. <code className="text-amber-400">/start</code>, <code className="text-amber-400">/list</code>, or <code className="text-amber-400">/remind 3:00 PM Team Sync</code>) to test bot responses.
                </p>
              </div>
            ) : (
              simHistory.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${item.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                      item.sender === 'user'
                        ? 'bg-amber-500 text-slate-950 font-medium rounded-br-none'
                        : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/80 whitespace-pre-wrap'
                    }`}
                  >
                    {item.text}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 px-1">{item.time}</span>
                </div>
              ))
            )}
            {simLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Bot processing message...</span>
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={simText}
              onChange={e => setSimText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendSim()}
              placeholder="Type /start, /list, /backup, or /remind 3:00 PM Task..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />
            <button
              onClick={handleSendSim}
              disabled={simLoading || !simText.trim()}
              className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl disabled:opacity-50 transition-all cursor-pointer"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Telegram Backup & Rollback Mechanism */}
      {activeTab === 'backups' && (
        <div className="space-y-6">
          {/* Action Header */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-emerald-400" />
                <span>Telegram Storage & Rollback Engine</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every backup is saved as an immutable rollback checkpoint and transmitted to your Telegram chat.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleTriggerBackup}
                disabled={backupLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{backupLoading ? 'Creating Backup...' : 'Backup to Telegram Now'}</span>
              </button>

              <button
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
                title="Download JSON file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>

              <button
                onClick={() => setShowJsonModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
                title="Paste JSON to restore"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Restore JSON</span>
              </button>
            </div>
          </div>

          {backupSuccess && (
            <div className="p-3 rounded-xl border border-emerald-800 bg-emerald-950/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{backupSuccess}</span>
            </div>
          )}

          {/* Rollbacks Timeline Grid */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white">Rollback Checkpoints Timeline ({rollbacks.length})</h4>
              <span className="text-xs text-slate-500">Auto-saved checkpoints</span>
            </div>

            {rollbacks.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No rollback points yet. Click &quot;Backup to Telegram Now&quot; above to create your first checkpoint!
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {rollbacks.map(rb => {
                  const date = new Date(rb.timestamp);
                  const isConfirming = restoreConfirming === rb.id;
                  return (
                    <div key={rb.id} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-200">{rb.label}</span>
                          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                            {rb.reminderCount} tasks
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-mono">
                          <span>{date.toLocaleDateString()} at {date.toLocaleTimeString()}</span>
                          <span>·</span>
                          <span className="capitalize text-slate-400">Via {rb.triggeredBy.replace('_', ' ')}</span>
                          <span>·</span>
                          <span>ID: {rb.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedRollback(rb)}
                          className="px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                        >
                          View tasks ({rb.dataSnapshot.length})
                        </button>

                        {isConfirming ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-amber-400 font-medium">Are you sure?</span>
                            <button
                              onClick={() => handleExecuteRollback(rb.id)}
                              className="px-2.5 py-1 text-xs font-bold bg-amber-400 text-slate-950 rounded-lg hover:bg-amber-300"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setRestoreConfirming(null)}
                              className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setRestoreConfirming(rb.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 hover:bg-emerald-900/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Rollback to this</span>
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

      {/* TAB 4: Vercel Exact-Time Deployment Guide */}
      {activeTab === 'vercel' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <CloudLightning className="w-4 h-4 text-indigo-400" />
              <span>Vercel Deployment for 24/7 Exact-Time Notifications</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              How to get exact reminder alerts on Telegram at your scheduled time without keeping any browser tab open.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h4 className="text-xs font-bold text-white">Vercel Cron Included</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                A pre-configured <code className="text-amber-400 font-mono">vercel.json</code> is included in this repository. It automatically calls <code className="text-amber-400 font-mono">/api/cron/tick</code> every minute.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h4 className="text-xs font-bold text-white">Environment Variables</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                In your Vercel Dashboard project settings, set:
                <br /><code className="text-slate-300 font-mono text-[11px]">TELEGRAM_BOT_TOKEN</code>
                <br /><code className="text-slate-300 font-mono text-[11px]">TELEGRAM_CHAT_ID</code>
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h4 className="text-xs font-bold text-white">Zero Latency Delivery</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                When a scheduled reminder time arrives, the cron worker queries pending tasks and dispatches the alert straight to your phone via Telegram!
              </p>
            </div>
          </div>

          {/* Deploy Command Snippet */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
            <span className="text-xs font-semibold text-slate-200">Deploy via Vercel CLI</span>
            <div className="bg-slate-900 rounded-lg p-2.5 font-mono text-xs text-emerald-400 border border-slate-800 flex items-center justify-between">
              <code>vercel --prod</code>
              <button
                onClick={() => navigator.clipboard.writeText('vercel --prod')}
                className="text-slate-400 hover:text-white"
                title="Copy"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Preview Modal */}
      {selectedRollback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0f172a] p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white">{selectedRollback.label}</h4>
                <span className="text-xs text-slate-400">
                  {new Date(selectedRollback.timestamp).toLocaleString()} ({selectedRollback.dataSnapshot.length} tasks)
                </span>
              </div>
              <button
                onClick={() => setSelectedRollback(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {selectedRollback.dataSnapshot.map(r => (
                <div key={r.id} className="p-2.5 rounded-lg border border-slate-800 bg-slate-900 text-xs">
                  <div className="font-semibold text-slate-200">{r.title}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Due: {new Date(r.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {r.category} · {r.priority}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  handleExecuteRollback(selectedRollback.id);
                  setSelectedRollback(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-xl hover:bg-emerald-300"
              >
                Rollback to this snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore JSON Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0f172a] p-6 space-y-4">
            <h4 className="text-sm font-bold text-white">Import & Restore JSON Backup</h4>
            <textarea
              rows={6}
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              placeholder="Paste JSON array of reminders here..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowJsonModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!jsonInput.trim()) return;
                  await onRestoreJson(jsonInput);
                  setShowJsonModal(false);
                  onRefresh();
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-xl hover:bg-emerald-300"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
