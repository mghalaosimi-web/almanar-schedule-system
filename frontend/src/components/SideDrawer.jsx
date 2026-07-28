/**
 * @file SideDrawer.jsx
 * @description القائمة الجانبية التفاعلية — HCI Phase 2 Overhaul
 * تدعم السحب والإفلات، التبديل السريع بين التبويبات، Glassmorphism، مع تحسينات HCI شاملة.
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

          {/* الدرج الجانبي */}
          <motion.aside
            variants={drawerVariants}
            initial="closed"
            animate="open"
            exit="closed"
            dir={isAr ? 'rtl' : 'ltr'}
            className="fixed top-0 bottom-0 z-50 flex flex-col"
            style={{
              [isAr ? 'right' : 'left']: 0,
              width: 'min(82vw, 300px)',
              background: 'linear-gradient(160deg, rgba(10,15,26,0.97) 0%, rgba(6,9,16,0.99) 100%)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              borderInlineEnd: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '20px 0 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset'
            }}
            role="navigation"
            aria-label={isAr ? 'القائمة الجانبية' : 'Side navigation'}
          >
            {/* ── رأس الدرج ── */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-[12px] flex items-center justify-center text-base"
                  style={{ background: 'rgba(var(--primary-color-rgb,245,158,11),0.1)', border: '1px solid rgba(var(--primary-color-rgb,245,158,11),0.2)' }}
                >
                  🎓
                </div>
                <div>
                  <h2 className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                    {isAr ? 'بوابة المنار' : 'Al-Manar Portal'}
                  </h2>
                  <p className="text-[9px] font-bold" style={{ color: 'var(--accent)' }}>
                    {isAr ? 'نظام الجدول الذكي' : 'Smart Schedule System'}
                  </p>
                </div>
              </div>

              {/* زر الإغلاق */}
              <button
                type="button"
                onClick={() => { haptics.impactLight(); onClose(); }}
                className="header-icon-btn"
                aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'}
                style={{ width: '32px', height: '32px', minWidth: '32px', borderRadius: '10px' }}
              >
                <span style={{ fontSize: '12px' }}>✕</span>
              </button>
            </div>

            {/* ── بطاقة الملف الشخصي ── */}
            <div
              className="mx-4 my-3 rounded-[18px] p-3.5 flex items-center gap-3 shrink-0"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
            >
              {/* أفاتار */}
              <div
                className="w-12 h-12 rounded-[14px] flex items-center justify-center font-black text-sm shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--primary-color-rgb),0.25) 0%, rgba(var(--primary-color-rgb),0.08) 100%)',
                  border: '1.5px solid rgba(var(--primary-color-rgb,245,158,11),0.35)',
                  color: 'var(--accent)'
                }}
              >
                {profile.name ? profile.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() : 'ST'}
              </div>

              {/* معلومات */}
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="text-[12px] font-black truncate" style={{ color: 'var(--text-primary)' }}>
                  {profile.name || 'Student'}
                </h3>
                <p className="text-[9.5px] font-semibold truncate" style={{ color: 'var(--text-muted)' }}>
                  {profile.department || 'Software Engineering'}
                </p>

                {/* XP Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black" style={{ color: 'var(--accent)' }}>
                      ⚡ {xp} XP
                    </span>
                    <span className="text-[8px] font-bold" style={{ color: 'var(--text-muted)' }}>
                      🔥 {profile.streak ?? 7} {isAr ? 'أيام' : 'days'}
                    </span>
                  </div>
                  <div className="attendance-bar-track" style={{ height: '4px' }}>
                    <div
                      className="attendance-bar-fill"
                      style={{ width: `${xpPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── قائمة التنقل الرئيسية ── */}
            <div className="flex-1 overflow-y-auto px-4 pb-2" style={{ scrollbarWidth: 'none' }}>
              <p
                className="text-[9px] font-black uppercase tracking-widest px-1 mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                {isAr ? 'التنقل السريع' : 'Quick Navigation'}
              </p>

              <nav className="space-y-1" role="menubar">
                {navItems.map(item => {
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => handleTabClick(item.id)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-[14px] text-[12px] font-bold transition-all"
                      style={{
                        background: active ? 'rgba(var(--primary-color-rgb,245,158,11),0.12)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${active ? 'rgba(var(--primary-color-rgb,245,158,11),0.25)' : 'rgba(255,255,255,0.04)'}`,
                        color: active ? 'var(--accent)' : 'var(--text-primary)'
                      }}
                      aria-current={active ? 'page' : undefined}
                    >
                      <div className="flex items-center gap-2.5">
                        <span style={{ fontSize: '15px' }}>{item.icon}</span>
                        <span>{isAr ? item.ar : item.en}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/* Badge خاص: عدد الإشعارات على "الإشعارات" */}
                        {active && (
                          <motion.div
                            layoutId="drawerActiveDot"
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: 'var(--accent)' }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}

                {/* زر مركز الإشعارات */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleOpenNotifs}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-[14px] text-[12px] font-bold transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span style={{ fontSize: '15px' }}>🔔</span>
                    <span>{isAr ? 'مركز الإشعارات' : 'Notifications'}</span>
                  </div>
                  {unreadNotificationsCount > 0 ? (
                    <span
                      className="text-[9px] font-black px-2 py-0.5 rounded-full"
                      style={{ background: '#ef4444', color: '#fff', boxShadow: '0 0 8px rgba(239,68,68,0.5)' }}
                    >
                      {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {isAr ? '←' : '→'}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* ── قسم الأدوات السفلية ── */}
            <div
              className="px-4 py-4 space-y-2 shrink-0"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              {/* زر تبديل الثيم */}
              <button
                type="button"
                onClick={() => {
                  haptics.impactLight();
                  soundEngine.playToggle(!isDark);
                  onToggleTheme();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-[14px] text-[11px] font-bold transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: 'var(--text-primary)'
                }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '15px' }}>{isDark ? '🌙' : '☀️'}</span>
                  <span>{isAr ? (isDark ? 'الوضع الليلي' : 'الوضع النهاري') : (isDark ? 'Dark Mode' : 'Light Mode')}</span>
                </div>
                <span
                  className="text-[9px] font-black uppercase font-mono"
                  style={{ color: 'var(--accent)' }}
                >
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
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[11px] font-bold transition-all"
                style={{
                  background: 'rgba(16,185,129,0.06)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  color: '#34d399',
                  textDecoration: 'none'
                }}
              >
                <span style={{ fontSize: '14px' }}>🤖</span>
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
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[11px] font-bold transition-all"
                style={{
                  background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.18)',
                  color: '#f87171'
                }}
              >
                <span style={{ fontSize: '14px' }}>🚪</span>
                <span>{isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
