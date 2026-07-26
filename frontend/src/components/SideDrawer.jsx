/**
 * @file SideDrawer.jsx
 * @description القائمة الجانبية التفاعلية السريعة (Glassmorphic Side Navigation Drawer)
 * تدعم السحب والإفلات، التبديل السريع بين التبويبات، فتح مركز الإشعارات، وتخصيص المظهر والصوت.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import haptics from '../utils/haptics';
import soundEngine from '../utils/soundEngine';

export default function SideDrawer({
  isOpen,
  onClose,
  profile,
  activeTab,
  onSelectTab,
  onOpenNotifications,
  onOpenSettings,
  onDownloadApk,
  onLogout,
  unreadNotificationsCount = 0,
  isDark,
  onToggleTheme,
}) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const drawerVariants = {
    closed: {
      x: isAr ? '100%' : '-100%',
      opacity: 0.8,
      transition: { type: 'spring', stiffness: 350, damping: 35 }
    },
    open: {
      x: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 350, damping: 30 }
    }
  };

  const handleTabClick = (tabId) => {
    haptics.selection();
    soundEngine.playClick();
    onSelectTab(tabId);
    onClose();
  };

  const handleOpenNotifs = () => {
    haptics.impactMedium();
    soundEngine.playClick();
    onOpenNotifications();
    onClose();
  };

  const handleOpenSettings = () => {
    haptics.impactMedium();
    soundEngine.playClick();
    onOpenSettings();
    onClose();
  };

  const handleThemeToggle = () => {
    haptics.impactLight();
    soundEngine.playToggle(!isDark);
    onToggleTheme();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              haptics.impactLight();
              onClose();
            }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer container */}
          <motion.aside
            variants={drawerVariants}
            initial="closed"
            animate="open"
            exit="closed"
            dir={isAr ? 'rtl' : 'ltr'}
            className="fixed top-0 bottom-0 z-50 w-[82vw] max-w-xs flex flex-col justify-between p-5 text-[var(--text-primary)] shadow-2xl border-l border-r border-white/10"
            style={{
              [isAr ? 'right' : 'left']: 0,
              background: 'linear-gradient(135deg, rgba(12, 18, 30, 0.96) 0%, rgba(6, 10, 18, 0.98) 100%)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.7), inset 0 1px 1px rgba(255,255,255,0.1)'
            }}
          >
            {/* Top section: Header & Profile Card */}
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent-glow)] flex items-center justify-center text-base">
                    🎓
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                      {isAr ? 'بوابة كلية المنار' : 'Al-Manar Portal'}
                    </h2>
                    <p className="text-[9px] text-[var(--accent)] font-bold">
                      {isAr ? 'القائمة الجانبية التفاعلية' : 'Interactive Menu'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    haptics.impactLight();
                    onClose();
                  }}
                  className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white flex items-center justify-center text-xs font-bold transition-all active:scale-95"
                >
                  ✕
                </button>
              </div>

              {/* Student Profile Quick Card */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[var(--accent)]/30 to-[var(--accent)]/10 border border-[var(--accent-glow)] flex items-center justify-center font-black text-sm text-[var(--accent)] shrink-0">
                  {profile.name ? profile.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-black text-white truncate">{profile.name || 'Student'}</h3>
                  <p className="text-[9px] text-[var(--text-secondary)] font-bold truncate mt-0.5">
                    {profile.department || 'Software Engineering'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-glow)]">
                      ⚡ {profile.xp || 350} XP
                    </span>
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      🔥 {profile.streak || 7} {isAr ? 'أيام' : 'Days'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <nav className="space-y-1.5 pt-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] px-2">
                  {isAr ? 'التنقل السريع' : 'Quick Navigation'}
                </p>

                {/* Home */}
                <button
                  type="button"
                  onClick={() => handleTabClick('home')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    activeTab === 'home'
                      ? 'bg-[var(--accent-dim)] border-[var(--accent-glow)] text-[var(--accent)]'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/5 text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">🏠</span>
                    <span>{isAr ? 'الشاشة الرئيسية' : 'Home Overview'}</span>
                  </div>
                  {activeTab === 'home' && <span className="text-[10px]">●</span>}
                </button>

                {/* Timetable Schedule */}
                <button
                  type="button"
                  onClick={() => handleTabClick('schedule')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    activeTab === 'schedule'
                      ? 'bg-[var(--accent-dim)] border-[var(--accent-glow)] text-[var(--accent)]'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/5 text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">📅</span>
                    <span>{isAr ? 'الجدول المحاضرات' : 'Schedule Timetable'}</span>
                  </div>
                  {activeTab === 'schedule' && <span className="text-[10px]">●</span>}
                </button>

                {/* Notification Center button */}
                <button
                  type="button"
                  onClick={handleOpenNotifs}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 text-[var(--text-primary)] text-xs font-bold transition-all relative"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">🔔</span>
                    <span>{isAr ? 'مركز الإشعارات' : 'Notification Center'}</span>
                  </div>
                  {unreadNotificationsCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-500 text-white animate-pulse shadow-md">
                      {unreadNotificationsCount}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--text-secondary)]">→</span>
                  )}
                </button>

                {/* Goals & Reminders */}
                <button
                  type="button"
                  onClick={() => handleTabClick('goals')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    activeTab === 'goals'
                      ? 'bg-[var(--accent-dim)] border-[var(--accent-glow)] text-[var(--accent)]'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/5 text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">🎯</span>
                    <span>{isAr ? 'المهام والأهداف الأكاديمية' : 'Academic Tasks & Goals'}</span>
                  </div>
                  {activeTab === 'goals' && <span className="text-[10px]">●</span>}
                </button>

                {/* Exchange Forum */}
                <button
                  type="button"
                  onClick={() => handleTabClick('exchange')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    activeTab === 'exchange'
                      ? 'bg-[var(--accent-dim)] border-[var(--accent-glow)] text-[var(--accent)]'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/5 text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">💬</span>
                    <span>{isAr ? 'ملتقى الشعبة والنقاشات' : 'Class Forum Hub'}</span>
                  </div>
                  {activeTab === 'exchange' && <span className="text-[10px]">●</span>}
                </button>

                {/* Settings & Sound */}
                <button
                  type="button"
                  onClick={handleOpenSettings}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 text-[var(--text-primary)] text-xs font-bold transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">⚙️</span>
                    <span>{isAr ? 'الإعدادات والصوت' : 'Profile & Audio Settings'}</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)]">→</span>
                </button>
              </nav>
            </div>

            {/* Bottom section: Theme Switcher, Android App & Logout */}
            <div className="space-y-2.5 pt-4 border-t border-white/10">
              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={handleThemeToggle}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold transition-all"
              >
                <div className="flex items-center gap-2">
                  <span>{isDark ? '🌙' : '☀️'}</span>
                  <span>{isAr ? (isDark ? 'الوضع الليلي نشط' : 'الوضع النهار') : (isDark ? 'Dark Mode Active' : 'Light Mode Active')}</span>
                </div>
                <span className="text-[10px] text-[var(--accent)] uppercase font-mono">
                  {isDark ? 'DARK' : 'LIGHT'}
                </span>
              </button>

              {/* Android APK Button */}
              <a
                href="/Manar_Schedule.apk"
                download="Manar_Schedule.apk"
                onClick={(e) => {
                  haptics.impactMedium();
                  soundEngine.playClick();
                  if (onDownloadApk) {
                    onDownloadApk(e);
                    onClose();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black rounded-xl text-xs font-bold transition-all cursor-pointer"
                style={{ textDecoration: 'none' }}
              >
                <span>🤖</span>
                <span>{isAr ? 'تطبيق الأندرويد (APK)' : 'Download Android App'}</span>
              </a>

              {/* Logout Button */}
              <button
                type="button"
                onClick={() => {
                  haptics.warning();
                  soundEngine.playClick();
                  onLogout();
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-xs font-bold transition-all active:scale-95"
              >
                <span>🚪</span>
                <span>{isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
