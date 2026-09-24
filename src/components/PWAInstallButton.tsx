import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { Download, Share2, Smartphone, X, CheckCircle2 } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installedNotice, setInstalledNotice] = useState(false);

  // If already running inside installed standalone app, don't show the prompt
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      setInstalledNotice(true);
      setTimeout(() => setInstalledNotice(false), 4000);
    }
  };

  return (
    <>
      {isInstallable && (
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-amber-600/20 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-amber-300 hover:border-amber-400 hover:from-amber-500/30 hover:to-amber-600/30 transition-all shadow-sm shadow-amber-950/40 cursor-pointer"
          title="Install app to your home screen or desktop"
        >
          <Download className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
          <span className="hidden sm:inline">Install App</span>
          <span className="sm:hidden">Install</span>
        </button>
      )}

      {isIOS && !isInstallable && (
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-amber-500/50 hover:text-white transition-all cursor-pointer"
          title="Add to iPhone/iPad Home Screen"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Install on iOS</span>
          <span className="sm:hidden">Install</span>
        </button>
      )}

      {/* Fallback Install trigger if browser has not yet fired beforeinstallprompt or desktop manual prompt */}
      {!isInstallable && !isIOS && (
        <button
          onClick={() => {
            alert('To install Nomatic Remember on your device:\n\n• On Chrome/Edge: Click the install icon (⊕ or ⬇) in the browser address bar.\n• On Mobile: Open browser menu (⋮) and tap "Add to Home screen" or "Install App".');
          }}
          className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-amber-300 hover:border-slate-700 transition-colors cursor-pointer"
          title="Install as Progressive Web App"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span>Install App</span>
        </button>
      )}

      {installedNotice && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-950/90 px-4 py-2.5 text-xs text-emerald-200 shadow-xl backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Nomatic Remember installed successfully!</span>
        </div>
      )}

      {/* iOS Safari Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Install on iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-300 font-mono">1</span>
                <div>
                  Tap the <strong className="text-amber-300">Share</strong> button <Share2 className="w-3.5 h-3.5 inline mx-1 text-sky-400" /> at the bottom or top of your Safari browser.
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-300 font-mono">2</span>
                <div>
                  Scroll down the share sheet and tap <strong className="text-amber-300">&quot;Add to Home Screen&quot;</strong>.
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-300 font-mono">3</span>
                <div>
                  Tap <strong className="text-amber-300">Add</strong> in the top right corner. You can now launch Nomatic Remember like a native app with offline support!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-2.5 text-xs font-bold text-slate-950 transition-colors shadow-lg shadow-amber-950/50 cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
