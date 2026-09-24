import React from 'react';
import { NrLogo } from './NrLogo.tsx';
import { Plus, Bell, Send } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface NavbarProps {
  currentView: 'tasks' | 'today' | 'upcoming' | 'telegram' | 'rollbacks';
  onSelectView: (view: 'tasks' | 'today' | 'upcoming' | 'telegram' | 'rollbacks') => void;
  onOpenNewModal: () => void;
  telegramConnected: boolean;
  onRequestNotificationPermission: () => void;
  notificationPermission: NotificationPermission | 'unsupported';
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  onOpenNewModal,
  telegramConnected,
  onRequestNotificationPermission,
  notificationPermission
}) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-800/80 bg-[#0f172a]/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single Brand Zone with NR Monogram + Clean Wordmark */}
        <div className="flex items-center gap-3">
          <NrLogo size="md" />
          <button
            onClick={() => onSelectView('tasks')}
            className="text-left focus:outline-none"
          >
            <span className="text-lg font-bold tracking-tight text-white hover:text-amber-400 transition-colors">
              Nomatic Remember
            </span>
          </button>
        </div>

        {/* Zone 2: 4-5 Clean Text Navigation Links (Single-Line, subtle hover) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            onClick={() => onSelectView('tasks')}
            className={`transition-colors hover:text-white whitespace-nowrap ${
              currentView === 'tasks' ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5' : ''
            }`}
          >
            All Tasks
          </button>
          <button
            onClick={() => onSelectView('today')}
            className={`transition-colors hover:text-white whitespace-nowrap ${
              currentView === 'today' ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5' : ''
            }`}
          >
            Today
          </button>
          <button
            onClick={() => onSelectView('upcoming')}
            className={`transition-colors hover:text-white whitespace-nowrap ${
              currentView === 'upcoming' ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5' : ''
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => onSelectView('telegram')}
            className={`flex items-center gap-1.5 transition-colors hover:text-white whitespace-nowrap ${
              currentView === 'telegram' ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5' : ''
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Telegram Hub</span>
            {telegramConnected ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Telegram Bot connected" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-rose-500" title="Telegram Bot not connected (No API key)" />
            )}
          </button>
          <button
            onClick={() => onSelectView('rollbacks')}
            className={`transition-colors hover:text-white whitespace-nowrap ${
              currentView === 'rollbacks' ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5' : ''
            }`}
          >
            Change Log
          </button>
        </nav>

        {/* Zone 3: 1-2 Primary Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <PWAInstallButton />

          {notificationPermission !== 'granted' && (
            <button
              onClick={onRequestNotificationPermission}
              title="Enable Browser Push Notifications"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700/60 transition-colors whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>Enable Push</span>
            </button>
          )}

          <button
            onClick={onOpenNewModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-md shadow-amber-500/20 active:scale-95 transition-all whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span>New Reminder</span>
          </button>
        </div>
      </div>
    </header>
  );
};
