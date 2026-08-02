import React from 'react';
import { motion } from 'framer-motion';

/**
 * MobileHeader Component
 * @description Glassmorphism header bar for mobile UI with interactive haptic touch feedback,
 * live notification badge indicator, avatar quick-action trigger, and WHCB high-contrast compliance.
 */
export default function MobileHeader({
  studentName = "طالب منار",
  greeting = "صباح الخير،",
  unreadNotifications = 0,
  avatarUrl = null,
  onAvatarClick = () => {},
  onNotificationClick = () => {},
  onScanClick = () => {},
  showScanButton = false
}) {
  return (
    <header className="sticky top-0 z-50 w-full px-5 py-3.5 frosted-panel rounded-b-[28px] border-b border-[var(--border-color)] transition-all duration-300">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        
        {/* Student Avatar & Greeting Info */}
        <div className="flex items-center gap-3.5">
          <motion.div
            whileTap={{ scale: 0.92 }}
            onClick={onAvatarClick}
            className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#f59e0b] via-amber-500 to-purple-600 p-[2px] shadow-lg shadow-amber-500/10 cursor-pointer active:opacity-90"
            title="الملف الشخصي"
          >
            <div className="w-full h-full rounded-[14px] border-2 border-[#070b13] overflow-hidden bg-slate-800 flex items-center justify-center text-amber-400 font-bold">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={studentName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-sm font-black uppercase">
                  {studentName ? studentName.charAt(0) : 'S'}
                </span>
              )}
            </div>
          </motion.div>
          
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-slate-400 leading-tight">
              {greeting}
            </span>
            <h1 className="text-sm font-black text-[var(--text-primary)] tracking-wide truncate max-w-[160px] sm:max-w-[240px]">
              {studentName}
            </h1>
          </div>
        </div>

        {/* Action Buttons (Scanner & Notification Bell) */}
        <div className="flex items-center gap-2.5">
          {showScanButton && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onScanClick}
              className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-amber-400 hover:border-[#f59e0b] hover:bg-amber-500/10 transition-colors forced-colors:border-[ButtonText]"
              title="ماسح الحضور QR"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m0 14v1m8-8h-1M5 12H4m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M9 9h6v6H9V9z" />
              </svg>
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onNotificationClick}
            className="relative p-2.5 rounded-2xl bg-white/5 border border-white/10 text-slate-200 hover:border-[#f59e0b] hover:text-amber-400 transition-colors forced-colors:border-[ButtonText]"
            title="الإشعارات والتنبيهات"
          >
            <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0.538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            
            {/* Live pulsing notification counter dot */}
            {unreadNotifications > 0 && (
              <>
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-[var(--bg-primary)]" />
              </>
            )}
          </motion.button>
        </div>

      </div>
    </header>
  );
}
