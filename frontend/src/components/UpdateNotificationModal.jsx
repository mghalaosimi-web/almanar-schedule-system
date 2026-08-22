import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function UpdateNotificationModal({ show, releaseInfo, onDismiss, isAr }) {
  if (!show || !releaseInfo) return null;

  const currentVer = '2.1.0'; // App version baseline for Web App
  const isMandatory = releaseInfo.minimumSupportedVersion && releaseInfo.minimumSupportedVersion > currentVer;

  const handleApplyUpdate = () => {
    // 1. Clear application caches and LocalStorage cached data
    try {
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
      // Unregister Service Workers to get fresh bundle
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        });
      }
    } catch (e) {
      console.warn('Cache clearing error during update:', e);
    }

    // 2. Hard reload page to fetch latest assets
    window.location.reload(true);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-[#0d1117] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.25)] relative overflow-hidden font-sans text-slate-100"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {/* Top glowing ambient accent */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 animate-pulse" />

          {/* Header Icon */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-3xl shrink-0 shadow-inner">
              🚀
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 block mb-0.5">
                {isMandatory ? (isAr ? 'تحديث إجباري مطلوب' : 'Mandatory Update Required') : (isAr ? 'تحديث جديد متوفر بالنظام' : 'New Release Available')}
              </span>
              <h2 className="text-xl font-black text-white tracking-wide">
                {isAr ? 'تحديث جديد للجداول والنظام' : 'System Upgrade Available'}
              </h2>
              <span className="text-xs font-mono font-bold text-slate-400">
                v{releaseInfo.latestVersion || '2.2.0'} (Build {releaseInfo.latestBuild || 4})
              </span>
            </div>
          </div>

          {/* Release Notes */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 space-y-2">
            <span className="text-xs font-bold text-cyan-300 block mb-2">
              {isAr ? '✨ ما الجديد في هذا التحديث:' : '✨ What’s new in this update:'}
            </span>
            {releaseInfo.releaseNotes && releaseInfo.releaseNotes.length > 0 ? (
              <ul className="space-y-1.5 text-xs text-slate-300">
                {releaseInfo.releaseNotes.map((note, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">
                {isAr ? 'يتضمن هذا الاصدار تحسينات أداء وتحديث الجداول وتطويرات أمنية جديدة.' : 'Includes performance optimizations, schedule synchronization & security fixes.'}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleApplyUpdate}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white font-black hover:shadow-[0_0_30px_rgba(6,182,212,0.45)] transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>⚡</span>
              <span>{isAr ? 'تحديث الواجهة والنظام الآن' : 'Apply System Update Now'}</span>
            </button>

            {releaseInfo.fullDownloadUrl && (
              <a
                href={releaseInfo.fullDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>📱</span>
                <span>{isAr ? 'تحميل تطبيق أندرويد (APK)' : 'Download Android App (APK)'}</span>
              </a>
            )}

            {!isMandatory && (
              <button
                onClick={onDismiss}
                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-white transition text-center cursor-pointer"
              >
                {isAr ? 'تذكيري لاحقاً' : 'Remind me later'}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
