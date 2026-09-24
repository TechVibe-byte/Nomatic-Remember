import React from 'react';
import { CheckSquare, Calendar, Send, RotateCcw, Plus } from 'lucide-react';

interface MobileBottomNavProps {
  currentView: 'tasks' | 'today' | 'upcoming' | 'telegram' | 'rollbacks';
  onSelectView: (view: 'tasks' | 'today' | 'upcoming' | 'telegram' | 'rollbacks') => void;
  onOpenNewModal: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onSelectView,
  onOpenNewModal
}) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-[#0f172a]/95 backdrop-blur-lg px-2 py-1">
      <div className="grid grid-cols-5 items-center h-14">
        {/* Tab 1: All Tasks */}
        <button
          onClick={() => onSelectView('tasks')}
          className={`min-h-[44px] flex flex-col items-center justify-center transition-colors cursor-pointer ${
            currentView === 'tasks' ? 'text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span className="text-[10px] mt-1 tracking-tight">Tasks</span>
        </button>

        {/* Tab 2: Today */}
        <button
          onClick={() => onSelectView('today')}
          className={`min-h-[44px] flex flex-col items-center justify-center transition-colors cursor-pointer ${
            currentView === 'today' ? 'text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span className="text-[10px] mt-1 tracking-tight">Today</span>
        </button>

        {/* Center: FAB Add */}
        <div className="flex items-center justify-center">
          <button
            onClick={onOpenNewModal}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 active:scale-90 transition-transform cursor-pointer"
            aria-label="Create reminder"
          >
            <Plus className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab 3: Telegram */}
        <button
          onClick={() => onSelectView('telegram')}
          className={`min-h-[44px] flex flex-col items-center justify-center transition-colors cursor-pointer ${
            currentView === 'telegram' ? 'text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Send className="w-4 h-4" />
          <span className="text-[10px] mt-1 tracking-tight">Telegram</span>
        </button>

        {/* Tab 4: Change Log & Rollback */}
        <button
          onClick={() => onSelectView('rollbacks')}
          className={`min-h-[44px] flex flex-col items-center justify-center transition-colors cursor-pointer ${
            currentView === 'rollbacks' ? 'text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-[10px] mt-1 tracking-tight">Change Log</span>
        </button>
      </div>
    </div>
  );
};
