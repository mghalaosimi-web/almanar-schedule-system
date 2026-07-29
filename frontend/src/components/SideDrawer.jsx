/**
 * @file SideDrawer.jsx
 * @description القائمة الجانبية التفاعلية — HCI Phase 2 Overhaul
 * متجاوبة بالكامل مع الوضع النهاري (Light Mode) والوضع الليلي (Dark Mode) بألوان متناسقة وفاخرة.
 * @author أنتيجرافيتي (Antigravity)
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import haptics from '../utils/haptics';
import soundEngine from '../utils/soundEngine';

export default function SideDrawer({
  isOpen, onClose, profile, activeTab, onSelectTab,
  onOpenNotifications, onOpenSettings, onDownloadApk,
  onLogout, unreadNotificationsCount = 0, isDark, onToggleTheme
}) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const drawerVariants = {
    closed: {
      x: isAr ? '100%' : '-100%',
      opacity: 0.9,
      transition: { type: 'spring', stiffness: 380, damping: 38 }
    },
    open: {
      x: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 380, damping: 32 }
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

  // تبويبات التنقل الرئيسية
  const navItems = [
    { id: 'home', icon: '🏠', ar: 'الشاشة الرئيسية', en: 'Home Overview' },
    { id: 'schedule', icon: '📅', ar: 'جدول المحاضرات', en: 'Schedule Timetable' },
    { id: 'goals', icon: '🎯', ar: 'المهام والأهداف', en: 'Tasks & Goals' },
    { id: 'exchange', icon: '💬', ar: 'ملتقى الشعبة', en: 'Class Forum' },
    { id: 'representative', icon: '👑', ar: 'بوابة المندوب', en: 'Delegate Portal' },
    { id: 'profile', icon: '👤', ar: 'الملف الشخصي', en: 'My Profile' },
  ];

  // حساب تقدم الـ XP
  const xp = profile.xp ?? 350;
  const xpForNextLevel = 500;
  const xpPct = Math.min((xp / xpForNextLevel) * 100, 100);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* خلفية الـ Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => { haptics.impactLight(); onClose(); }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
            aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'}
          />

          {/* الدرج الجانبي المتجاوب مع الثيمات */}
          <motion.aside
            variants={drawerVariants}
            initial="closed"
            animate="open"
            exit="closed"
            dir={isAr ? 'rtl' : 'ltr'}
            className="fixed top-0 bottom-0 z-50 flex flex-col font-sans"
            style={{
              [isAr ? 'right' : 'left']: 0,
              width: 'min(82vw, 300px)',
              background: isDark 
                ? 'linear-gradient(160deg, rgba(15,23,42,0.98) 0%, rgba(10,15,28,0.99) 100%)'
                : 'linear-gradient(160deg, #ffffff 0%, #f8fafc 100%)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              borderInlineEnd: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
              boxShadow: isDark ? '20px 0 60px rgba(0,0,0,0.8)' : '20px 0 60px rgba(0,0,0,0.15)'
            }}
            role="navigation"
            aria-label={isAr ? 'القائمة الجانبية' : 'Side navigation'}
          >
            {/* ── رأس الدرج ── */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-[12px] flex items-center justify-center text-base shadow-sm"
                  style={{ background: 'rgba(var(--primary-color-rgb,245,158,11),0.15)', border: '1px solid rgba(var(--primary-color-rgb,245,158,11),0.3)' }}
                >
                  🎓
                </div>
                <div>
                  <h2 className="text-[11px] font-black uppercase tracking-wider" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                    {isAr ? 'بوابة المنار' : 'Al-Manar Portal'}
                  </h2>
                  <p className="text-[9px] font-extrabold" style={{ color: 'var(--accent)' }}>
                    {isAr ? 'نظام الجدول الذكي' : 'Smart Schedule System'}
                  </p>
                </div>
              </div>

              {/* زر الإغلاق */}
              <button
                type="button"
                onClick={() => { haptics.impactLight(); onClose(); }}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'}
              >
                <span className="font-black text-xs">✕</span>
              </button>
            </div>

            {/* ── بطاقة الملف الشخصي ── */}
            <div
              className="mx-4 my-3 rounded-[18px] p-3.5 flex items-center gap-3 shrink-0 shadow-sm"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
              }}
            >
              {/* أفاتار */}
              <div
                className="w-12 h-12 rounded-[14px] flex items-center justify-center font-black text-sm shrink-0 shadow-inner overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--primary-color-rgb),0.3) 0%, rgba(var(--primary-color-rgb),0.1) 100%)',
                  border: '1.5px solid rgba(var(--primary-color-rgb,245,158,11),0.4)',
                  color: 'var(--accent)'
                }}
              >
                {profile.idPhotoUrl ? (
                  <img src={profile.idPhotoUrl} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  profile.name ? profile.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() : 'ST'
                )}
              </div>

              {/* معلومات */}
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="text-[12px] font-black truncate" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                  {profile.name || 'Student'}
                </h3>
                <p className="text-[9.5px] font-bold truncate" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                  {profile.department || 'Software Engineering'}
                </p>

                {/* XP Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-[var(--accent)]">
                      ⚡ {xp} XP
                    </span>
                    <span className="text-[8px] font-bold" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                      🔥 {profile.streak ?? 7} {isAr ? 'أيام' : 'days'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700/30 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] transition-all duration-500"
                      style={{ width: `${xpPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── قائمة التنقل الرئيسية ── */}
            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1" style={{ scrollbarWidth: 'none' }}>
              <p
                className="text-[9px] font-black uppercase tracking-widest px-1 mb-2 mt-1"
                style={{ color: isDark ? '#64748b' : '#94a3b8' }}
              >
                {isAr ? 'التنقل السريع' : 'Quick Navigation'}
              </p>

              <nav className="space-y-1.5" role="menubar">
                {navItems.map(item => {
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => handleTabClick(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[14px] text-[12px] font-black transition-all ${
                        active
                          ? 'bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] shadow-sm'
                          : isDark
                            ? 'bg-slate-900/40 border border-white/5 text-slate-200 hover:bg-slate-800/60'
                            : 'bg-slate-100/80 border border-slate-200 text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{item.icon}</span>
                        <span>{isAr ? item.ar : item.en}</span>
                      </div>
                      {active && (
                        <motion.div
                          layoutId="drawerActiveDot"
                          className="w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                        />
                      )}
                    </button>
                  );
                })}

                {/* زر مركز الإشعارات */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleOpenNotifs}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[14px] text-[12px] font-black transition-all ${
                    isDark
                      ? 'bg-slate-900/40 border border-white/5 text-slate-200 hover:bg-slate-800/60'
                      : 'bg-slate-100/80 border border-slate-200 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🔔</span>
                    <span>{isAr ? 'مركز الإشعارات' : 'Notifications'}</span>
                  </div>
                  {unreadNotificationsCount > 0 ? (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                      {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">
                      {isAr ? '←' : '→'}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* ── قسم الأدوات السفلية ── */}
            <div
              className="px-4 py-3.5 space-y-2 shrink-0"
              style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)' }}
            >
              {/* زر تبديل الثيم */}
              <button
                type="button"
                onClick={() => {
                  haptics.impactLight();
                  soundEngine.playToggle(!isDark);
                  onToggleTheme();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[14px] text-[11px] font-black transition-all ${
                  isDark ? 'bg-slate-900/80 border border-white/10 text-white' : 'bg-slate-100 border border-slate-300 text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{isDark ? '🌙' : '☀️'}</span>
                  <span>{isAr ? (isDark ? 'الوضع الليلي' : 'الوضع النهاري') : (isDark ? 'Dark Mode' : 'Light Mode')}</span>
                </div>
                <span className="text-[9px] font-mono font-black text-[var(--accent)]">
                  {isDark ? 'DARK' : 'LIGHT'}
                </span>
              </button>

              {/* تحميل APK */}
              <a
                href="/Manar_Schedule.apk"
                download="Manar_Schedule.apk"
                onClick={(e) => {
                  haptics.impactMedium();
                  soundEngine.playClick();
                  if (onDownloadApk) { onDownloadApk(e); onClose(); }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[11px] font-black bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-decoration-none"
              >
                <span className="text-sm">🤖</span>
                <span>{isAr ? 'تطبيق أندرويد (APK)' : 'Android App (APK)'}</span>
              </a>

              {/* تسجيل الخروج */}
              <button
                type="button"
                onClick={() => {
                  haptics.warning();
                  soundEngine.playClick();
                  onLogout();
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[11px] font-black bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition-all"
              >
                <span className="text-sm">🚪</span>
                <span>{isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
