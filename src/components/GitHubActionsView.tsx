import React, { useState, useEffect } from 'react';
import { GitHubActionRun } from '../types.ts';
import {
  Play,
  Copy,
  Check,
  Download,
  Terminal,
  Shield,
  Clock,
  RefreshCw,
  ExternalLink,
  Calendar,
  AlertCircle,
  FileCode,
  Zap,
  Key
} from 'lucide-react';

interface GitHubActionsViewProps {
  onBackToTasks: () => void;
  telegramConnected: boolean;
}

interface GitHubConfigResponse {
  enabled: boolean;
  secret: string;
  scheduleCron: string;
  endpointUrl: string;
  appUrl: string;
  lastRun?: GitHubActionRun;
  totalRuns: number;
  telegramConfigured: boolean;
  telegramChatId: string;
  activeRemindersCount: number;
}

export const GitHubActionsView: React.FC<GitHubActionsViewProps> = ({
  onBackToTasks,
  telegramConnected
}) => {
  const [config, setConfig] = useState<GitHubConfigResponse | null>(null);
  const [runs, setRuns] = useState<GitHubActionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: {
      checkedCount?: number;
      notifiedCount?: number;
      durationMs?: number;
      [key: string]: unknown;
    };
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'workflows' | 'secrets' | 'history' | 'terminal'>('workflows');
  const [activeWorkflow, setActiveWorkflow] = useState<'notifications' | 'digest' | 'curl'>('notifications');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [selectedActionType, setSelectedActionType] = useState<'tick' | 'digest' | 'test'>('tick');

  const fetchConfigAndRuns = async () => {
    try {
      setLoading(true);
      const [confRes, runsRes] = await Promise.all([
        fetch('/api/github-actions/config'),
        fetch('/api/github-actions/runs')
      ]);
      if (confRes.ok) {
        const confData = await confRes.json();
        setConfig(confData);
      }
      if (runsRes.ok) {
        const runsData = await runsRes.json();
        setRuns(runsData);
      }
    } catch (err) {
      console.error('Failed to load GitHub Actions config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigAndRuns();
  }, []);

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTriggerRun = async () => {
    try {
      setTriggering(true);
      setTestResult(null);

      const res = await fetch('/api/github-actions/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config?.secret || ''}`
        },
        body: JSON.stringify({
          action: selectedActionType,
          source: 'manual_test',
          githubEvent: 'workflow_dispatch'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setTestResult({
          success: true,
          message: data.message || 'Workflow executed successfully!',
          details: data
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Failed to trigger workflow',
          details: data
        });
      }
      fetchConfigAndRuns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        success: false,
        message: `Network trigger error: ${msg}`
      });
    } finally {
      setTriggering(false);
    }
  };

  const handleRegenerateSecret = async () => {
    if (!confirm('Regenerate your webhook secret? You will need to update GITHUB_ACTIONS_SECRET in GitHub Secrets.')) {
      return;
    }
    try {
      const res = await fetch('/api/github-actions/regenerate-secret', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (config) {
          setConfig({ ...config, secret: data.secret });
        }
        alert('New webhook secret generated! Make sure to update your GitHub Actions Secret.');
      }
    } catch (e) {
      console.error('Failed to regenerate secret:', e);
    }
  };

  const notificationsWorkflowYaml = `name: Nomatic Remember - Scheduled Notifications

on:
  schedule:
    # Runs every 15 minutes (Exact-time check)
    - cron: '*/15 * * * *'
  workflow_dispatch:
    inputs:
      action_type:
        description: 'Action to perform'
        required: true
        default: 'tick'
        type: choice
        options:
          - tick
          - digest
          - test
      force_notify:
        description: 'Force dispatch alerts even if advance window has not arrived'
        required: false
        default: false
        type: boolean

concurrency:
  group: nomatic-remember-notifications
  cancel-in-progress: false

jobs:
  check-and-notify:
    name: Check Deadlines & Dispatch Alerts
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run Nomatic Remember Notification Dispatcher
        env:
          APP_URL: \${{ secrets.APP_URL }}
          REMINDER_CRON_SECRET: \${{ secrets.REMINDER_CRON_SECRET || secrets.CRON_SECRET }}
          TELEGRAM_BOT_TOKEN: \${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: \${{ secrets.TELEGRAM_CHAT_ID }}
          ACTION_TYPE: \${{ github.event.inputs.action_type || 'tick' }}
          FORCE_NOTIFY: \${{ github.event.inputs.force_notify || 'false' }}
          GITHUB_RUN_ID: \${{ github.run_id }}
          GITHUB_WORKFLOW: \${{ github.workflow }}
          GITHUB_EVENT_NAME: \${{ github.event_name }}
        run: |
          node scripts/github-actions-notify.mjs
`;

  const dailyDigestYaml = `name: Nomatic Remember - Morning Daily Digest

on:
  schedule:
    # Runs daily at 08:00 UTC (Morning briefing)
    - cron: '0 8 * * *'
  workflow_dispatch:

concurrency:
  group: nomatic-remember-daily-digest
  cancel-in-progress: false

jobs:
  morning-digest:
    name: Send Morning Task Digest
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Dispatch Morning Schedule Digest
        env:
          APP_URL: \${{ secrets.APP_URL }}
          REMINDER_CRON_SECRET: \${{ secrets.REMINDER_CRON_SECRET || secrets.CRON_SECRET }}
          TELEGRAM_BOT_TOKEN: \${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: \${{ secrets.TELEGRAM_CHAT_ID }}
          ACTION_TYPE: digest
          GITHUB_RUN_ID: \${{ github.run_id }}
          GITHUB_WORKFLOW: \${{ github.workflow }}
          GITHUB_EVENT_NAME: \${{ github.event_name }}
        run: |
          node scripts/github-actions-notify.mjs
`;

  const currentAppUrl = config?.appUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const curlExample = `curl -X POST "${currentAppUrl}/api/github-actions/run" \\
  -H "Authorization: Bearer ${config?.secret || 'YOUR_SECRET'}" \\
  -H "Content-Type: application/json" \\
  -d '{"action": "tick"}'`;

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 p-6 shadow-xl">
        <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute right-1/4 -bottom-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Continuous Cloud Automation
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-800/40">
                <Clock className="w-3 h-3 text-emerald-400" />
                Schedule: */15 * * * *
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              GitHub Actions Notifications
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Automate exact-time reminder notifications using GitHub-hosted runners. Runs 24/7 on a scheduled cron
              even when your browser tab is closed, evaluating deadlines and dispatching instant alerts to Telegram.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800/80 p-1">
              <select
                aria-label="Action Type"
                value={selectedActionType}
                onChange={(e) => setSelectedActionType(e.target.value as 'tick' | 'digest' | 'test')}
                className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none px-2 py-1 cursor-pointer"
              >
                <option value="tick" className="bg-slate-900 text-white">Action: Tick (Due Check)</option>
                <option value="digest" className="bg-slate-900 text-white">Action: Morning Digest</option>
                <option value="test" className="bg-slate-900 text-white">Action: Connection Test</option>
              </select>
            </div>

            <button
              onClick={handleTriggerRun}
              disabled={triggering}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
            >
              {triggering ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Executing Action...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950 text-slate-950" />
                  <span>Trigger Action Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Test Feedback Banner */}
        {testResult && (
          <div
            className={`mt-4 p-4 rounded-xl border flex items-start gap-3 transition-all ${
              testResult.success
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
            }`}
          >
            {testResult.success ? (
              <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 text-xs">
              <div className="font-semibold text-sm">
                {testResult.success ? 'Workflow Trigger Successful' : 'Workflow Trigger Failed'}
              </div>
              <div className="text-slate-300">{testResult.message}</div>
              {testResult.details && (
                <div className="text-[11px] font-mono text-slate-400 pt-1">
                  Evaluated: {Number(testResult.details.checkedCount ?? 0)} reminders | Alerts: {Number(testResult.details.notifiedCount ?? 0)} sent | Latency: {Number(testResult.details.durationMs ?? 0)}ms
                </div>
              )}
            </div>
            <button
              onClick={() => setTestResult(null)}
              className="ml-auto text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 gap-2 sm:gap-4 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('workflows')}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'workflows'
              ? 'border-amber-400 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Workflow Files (.github/workflows)</span>
        </button>

        <button
          onClick={() => setActiveTab('secrets')}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'secrets'
              ? 'border-amber-400 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Repository Secrets Setup</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-amber-400 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Runs History ({runs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('terminal')}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'terminal'
              ? 'border-amber-400 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>cURL & Webhook Trigger</span>
        </button>
      </div>

      {/* Tab 1: Workflow Files */}
      {activeTab === 'workflows' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-1">
              <button
                onClick={() => setActiveWorkflow('notifications')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeWorkflow === 'notifications'
                    ? 'bg-amber-500/20 text-amber-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                remember-notifications.yml (Every 15m)
              </button>
              <button
                onClick={() => setActiveWorkflow('digest')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeWorkflow === 'digest'
                    ? 'bg-amber-500/20 text-amber-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                daily-digest.yml (Daily 8 AM)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  copyToClipboard(
                    activeWorkflow === 'notifications' ? notificationsWorkflowYaml : dailyDigestYaml,
                    'yaml'
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                {copiedKey === 'yaml' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied YAML</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy YAML</span>
                  </>
                )}
              </button>

              <button
                onClick={() =>
                  downloadFile(
                    activeWorkflow === 'notifications' ? notificationsWorkflowYaml : dailyDigestYaml,
                    activeWorkflow === 'notifications'
                      ? 'remember-notifications.yml'
                      : 'daily-digest.yml'
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .yml</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-xs text-slate-400">
              <div className="flex items-center gap-2 font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 text-slate-300">
                  {activeWorkflow === 'notifications'
                    ? '.github/workflows/remember-notifications.yml'
                    : '.github/workflows/daily-digest.yml'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Workflow Definition</span>
            </div>
            <pre className="p-4 text-xs font-mono text-emerald-300/90 overflow-x-auto leading-relaxed max-h-[500px]">
              {activeWorkflow === 'notifications' ? notificationsWorkflowYaml : dailyDigestYaml}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 2: Repository Secrets Setup */}
      {activeTab === 'secrets' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-xs text-slate-300 space-y-2">
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Configure GitHub Repository Secrets
            </h3>
            <p>
              In your GitHub Repository, navigate to <strong>Settings</strong> &rarr;{' '}
              <strong>Secrets and variables</strong> &rarr; <strong>Actions</strong> &rarr;{' '}
              <strong>New repository secret</strong>. Add the following secrets:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Secret 1: APP_URL */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-amber-400">APP_URL</span>
                <button
                  onClick={() => copyToClipboard(currentAppUrl, 'app_url')}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded border border-slate-700 cursor-pointer"
                >
                  {copiedKey === 'app_url' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'app_url' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400">The public web address of your hosted Nomatic Remember instance.</p>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80 font-mono text-xs text-emerald-300 break-all select-all">
                {currentAppUrl}
              </div>
            </div>

            {/* Secret 2: REMINDER_CRON_SECRET */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-amber-400">REMINDER_CRON_SECRET</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-[11px] text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded border border-slate-700 cursor-pointer"
                  >
                    {showSecret ? 'Hide' : 'Reveal'}
                  </button>
                  <button
                    onClick={() => copyToClipboard(config?.secret || '', 'gh_secret')}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded border border-slate-700 cursor-pointer"
                  >
                    {copiedKey === 'gh_secret' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'gh_secret' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">Authentication bearer token protecting the runner trigger endpoint.</p>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80 font-mono text-xs text-emerald-300 break-all select-all">
                {showSecret ? config?.secret : '••••••••••••••••••••••••••••••••'}
              </div>
              <button
                onClick={handleRegenerateSecret}
                className="text-[11px] text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                Regenerate secret token &rarr;
              </button>
            </div>

            {/* Secret 3: TELEGRAM_BOT_TOKEN */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-amber-400">TELEGRAM_BOT_TOKEN</span>
                <span className="text-[10px] text-slate-400">From @BotFather</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Your Telegram bot API token for direct alerts dispatch from runner fallback.
              </p>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80 font-mono text-xs text-slate-400">
                {telegramConnected ? 'Configured in Telegram Hub' : 'Add token in Telegram Hub or GitHub Secrets'}
              </div>
            </div>

            {/* Secret 4: TELEGRAM_CHAT_ID */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-amber-400">TELEGRAM_CHAT_ID</span>
                {config?.telegramChatId && (
                  <button
                    onClick={() => copyToClipboard(config.telegramChatId, 'chat_id')}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded border border-slate-700 cursor-pointer"
                  >
                    {copiedKey === 'chat_id' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'chat_id' ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Your recipient Chat ID for instant Telegram notifications.</p>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80 font-mono text-xs text-emerald-300">
                {config?.telegramChatId || 'Not connected yet (See Telegram Hub)'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Recent workflow executions and runner dispatches:</span>
            <button
              onClick={fetchConfigAndRuns}
              className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>

          {runs.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/40 text-slate-400 text-xs">
              No executions logged yet. Click &quot;Trigger Action Now&quot; above to simulate your first workflow run!
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                    <th className="p-3 font-semibold">Timestamp</th>
                    <th className="p-3 font-semibold">Trigger</th>
                    <th className="p-3 font-semibold">Evaluated</th>
                    <th className="p-3 font-semibold">Alerts Sent</th>
                    <th className="p-3 font-semibold">Latency</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {runs.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3 font-mono text-slate-300 whitespace-nowrap">
                        {new Date(run.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {run.trigger}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-200">{run.checkedCount}</td>
                      <td className="p-3 font-semibold text-amber-400">{run.notifiedCount}</td>
                      <td className="p-3 font-mono text-slate-400">{run.durationMs ?? 0}ms</td>
                      <td className="p-3 whitespace-nowrap">
                        {run.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                            <Check className="w-3.5 h-3.5" /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400">
                            <AlertCircle className="w-3.5 h-3.5" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 max-w-xs truncate" title={run.details}>
                        {run.details || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: cURL & Webhook Trigger */}
      {activeTab === 'terminal' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-xs text-slate-300 space-y-2">
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-400" />
              Direct HTTP Webhook Trigger
            </h3>
            <p>
              You can trigger the exact-time notification check from any server, cron service (e.g. CronJob, EasyCron),
              or local terminal script:
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-xs text-slate-400">
              <span className="font-mono text-slate-300">Terminal cURL Command</span>
              <button
                onClick={() => copyToClipboard(curlExample, 'curl')}
                className="flex items-center gap-1 text-slate-300 hover:text-white px-2 py-1 bg-slate-800 rounded border border-slate-700 cursor-pointer"
              >
                {copiedKey === 'curl' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'curl' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-amber-300 overflow-x-auto leading-relaxed select-all">
              {curlExample}
            </pre>
          </div>
        </div>
      )}

      {/* Back to tasks footer link */}
      <div className="pt-4 flex justify-between items-center text-xs text-slate-400">
        <button
          onClick={onBackToTasks}
          className="text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          &larr; Back to Reminders Dashboard
        </button>

        <a
          href="https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-slate-200 transition-colors"
        >
          <span>GitHub Actions Cron Documentation</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
