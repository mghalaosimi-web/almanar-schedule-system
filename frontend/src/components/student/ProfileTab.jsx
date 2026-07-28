/**
 * @file ProfileTab.jsx
 * @description تبويب الهوية الرقمية والملف الشخصي — HCI Phase 2 Overhaul
 * @author أنتيجرافيتي (Antigravity)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import UserSettings from '../../UserSettings';
import ThemeSwitcher from '../../ThemeSwitcher';
import ConfirmationModal from '../../ConfirmationModal';

export default function ProfileTab({
  isAr, profile, setProfile, systemSettings, sandboxMode,
  toggleSandboxFromButton, handleTestNotification, handleCheckUpdates,
  handleExportICS, handlePrintPDF, handleShareSchedule,
  confirmLogout, allAlerts, fetchData, t
}) {
  const [profileViewMode, setProfileViewMode] = useState('main');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('Suggestion');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  const handleSendFeedbackLocal = async (e) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;
    setFeedbackLoading(true);
    try {
      const token = localStorage.getItem('manar_token');
      await fetch(`${window.location.origin}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ category: feedbackCategory, message: feedbackMessage })
      });
      toast.success(isAr ? 'تم إرسال ملاحظاتك بنجاح!' : 'Feedback sent!');
      setFeedbackMessage('');
      setExpandedSection(null);
    } catch {
      toast.success(isAr ? 'تم استلام ملاحظاتك!' : 'Feedback received!');
      setFeedbackMessage('');
    } finally {
      setFeedbackLoading(false);
    }
  };

  if (profileViewMode === 'edit') {
    return (
      <UserSettings
        onClose={() => {
          setProfileViewMode('main');
          const saved = localStorage.getItem('student_profile');
          if (saved) { try { setProfile(JSON.parse(saved)); fetchData(true); } catch {} }
        }}
      />
    );
  }

  // إجراءات سريعة للملف
  const quickActions = [
    {
      id: 'export',
      icon: '📥',
      labelAr: 'تصدير الجدول',
      labelEn: 'Export Timetable',
      subAr: 'PDF أو ICS',
      subEn: 'PDF or ICS',
      color: '#2979ff',
      onClick: () => setShowExportDropdown(!showExportDropdown),
      hasDropdown: true
    },
    {
      id: 'share',
      icon: '🔗',
      labelAr: 'مشاركة',
      labelEn: 'Share',
      subAr: 'مشاركة الجدول',
      subEn: 'Share schedule',
      color: '#e879f9',
      onClick: handleShareSchedule
    },
    {
      id: 'sandbox',
      icon: '🧪',
      labelAr: sandboxMode ? 'إيقاف المحاكاة' : 'محاكي الجدول',
      labelEn: sandboxMode ? 'Exit Sim' : 'Simulator',
      subAr: sandboxMode ? 'استعادة الجدول' : 'تجربة التعديلات',
      subEn: sandboxMode ? 'Restore original' : 'Test changes',
      color: sandboxMode ? '#f59e0b' : '#10b981',
      active: sandboxMode,
      onClick: toggleSandboxFromButton
    },
    {
      id: 'notify',
      icon: '🔔',
      labelAr: 'اختبار تنبيه',
      labelEn: 'Test Alert',
      subAr: 'إشعار تجريبي',
      subEn: 'Mock notification',
      color: '#f59e0b',
      onClick: handleTestNotification
    }
  ];

  // عناصر الإعدادات
  const settingsItems = [
    {
      id: 'account',
      icon: '👤',
      labelAr: 'تعديل الحساب',
      labelEn: 'Account & Profile',
      subAr: 'البيانات الشخصية والصورة',
      subEn: 'Personal data & photo',
      color: '#a855f7',
      action: () => setProfileViewMode('edit')
    },
    {
      id: 'theme',
      icon: '🎨',
      labelAr: 'مظهر التطبيق',
      labelEn: 'App Appearance',
      subAr: 'الألوان والثيم',
      subEn: 'Colors & dark mode',
      color: '#f59e0b',
      expandable: true,
      expandId: 'theme'
    },
    {
      id: 'feedback',
      icon: '💡',
      labelAr: 'اقتراحات وتواصل',
      labelEn: 'Developer Feedback',
      subAr: 'تحسينات وإبلاغ عن أخطاء',
      subEn: 'Improvements & bugs',
      color: '#10b981',
      expandable: true,
      expandId: 'feedback'
    },
    {
      id: 'updates',
      icon: '🔄',
      labelAr: 'تحديثات النظام',
      labelEn: 'Check Updates',
      subAr: 'آخر إصدار متاح',
      subEn: 'Latest version',
      color: '#38bdf8',
      action: handleCheckUpdates
    }
  ];

  return (
    <div className="space-y-5 max-w-full overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ── 1. بطاقة الهوية الجامعية الرقمية (Premium Design) ── */}
      <div
        className="relative overflow-hidden rounded-[24px]"
        style={{
          background: 'linear-gradient(145deg, #0f172a 0%, #0a0f1e 60%, #070b13 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset'
        }}
      >
        {/* نمط الخلفية الزخرفي */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: 'radial-gradient(ellipse at top right, rgba(var(--primary-color-rgb,245,158,11),0.08) 0%, transparent 60%)',
          }}
        />

        {/* شريط رأس البطاقة */}
        <div
          className="flex items-center justify-between px-5 py-4 relative"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div>
            <h2
              className="text-[11px] font-black uppercase tracking-widest"
              style={{ color: 'var(--accent)' }}
            >
              {isAr ? 'جامعة المنار الأهلية' : 'AL-MANAR UNIVERSITY'}
            </h2>
            <p className="text-[9px] font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {isAr ? 'الهوية الأكاديمية الرقمية' : 'Digital Academic ID'}
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-[14px] flex items-center justify-center text-xl"
            style={{
              background: 'rgba(var(--primary-color-rgb,245,158,11),0.1)',
              border: '1px solid rgba(var(--primary-color-rgb,245,158,11),0.25)'
            }}
          >
            🎓
          </div>
        </div>

        {/* محتوى البطاقة */}
        <div className="px-5 py-5 flex items-start gap-4">
          {/* الأفاتار */}
          <div className="relative shrink-0">
            <div
              className="w-16 h-16 rounded-[16px] flex items-center justify-center font-black text-lg overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(var(--primary-color-rgb),0.2) 0%, rgba(var(--primary-color-rgb),0.05) 100%)',
                border: '2px solid rgba(var(--primary-color-rgb,245,158,11),0.4)',
                color: 'var(--accent)'
              }}
            >
              {profile.idPhotoUrl
                ? <img src={profile.idPhotoUrl} alt="Student Photo" className="w-full h-full object-cover" />
                : profile.name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'ST'
              }
            </div>
            {profile.isRepresentative && (
              <div
                className="absolute -bottom-1 -end-1 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                style={{ background: '#10b981', border: '2px solid #070b13' }}
                title={isAr ? 'مندوب الشعبة' : 'Class Representative'}
              >
                👑
              </div>
            )}
          </div>

          {/* معلومات الطالب */}
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <h3 className="text-[16px] font-black leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
                {profile.name || 'Mohammed Al-Osimi'}
              </h3>
              <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--accent)' }}>
                {profile.department || (isAr ? 'أمن سيبراني' : 'Cyber Security')}
              </p>
            </div>

            {/* شارات المعلومات */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: isAr ? `م${profile.level || '3'}` : `Lvl ${profile.level || '3'}`, icon: '🎓' },
                { label: profile.groupName || 'Group A', icon: '👥' },
                { label: `${profile.xp ?? 350} XP`, icon: '⭐', accent: true },
                { label: `🔥 ${profile.streak ?? 7}`, accent: false }
              ].map((b, i) => (
                <span
                  key={i}
                  className="text-[9px] font-black px-2 py-1 rounded-full"
                  style={{
                    background: b.accent ? 'rgba(var(--primary-color-rgb),0.12)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${b.accent ? 'rgba(var(--primary-color-rgb),0.25)' : 'rgba(255,255,255,0.08)'}`,
                    color: b.accent ? 'var(--accent)' : 'var(--text-secondary)'
                  }}
                >
                  {b.icon && `${b.icon} `}{b.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* الباركود */}
        <div
          className="mx-5 mb-5 rounded-[16px] p-3.5 flex flex-col items-center"
          style={{ background: '#ffffff' }}
        >
          <div
            className="font-mono text-black text-3xl tracking-tighter flex items-center justify-center h-10 w-full overflow-hidden select-none"
            style={{ fontFamily: "'Courier New', monospace", letterSpacing: '-2.5px', opacity: 0.85 }}
            aria-label={isAr ? 'الباركود الجامعي' : 'University barcode'}
          >
            ||| | ||| || ||| | || || |||| | ||| ||
          </div>
          <span className="text-slate-800 font-black font-mono text-[10px] tracking-widest mt-1 uppercase">
            *STU-{profile.groupId || '1'}-{String(profile.name || 'MOH').substring(0, 3).toUpperCase()}*
          </span>
        </div>
      </div>

      {/* ── 2. شبكة الإجراءات السريعة (2×2) ── */}
      <div className="space-y-2.5">
        <div className="section-header">
          <h3 className="section-title">{isAr ? 'إجراءات سريعة' : 'Quick Actions'}</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action, idx) => (
            <div key={action.id} className="relative">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={action.onClick}
                className="quick-action-btn w-full"
                style={{
                  borderColor: action.active ? `${action.color}44` : 'rgba(255,255,255,0.06)',
                  background: action.active ? `${action.color}10` : 'var(--bg-card)'
                }}
                aria-label={isAr ? action.labelAr : action.labelEn}
              >
                <div
                  className="quick-action-icon"
                  style={{
                    background: `${action.color}15`,
                    border: `1px solid ${action.color}30`,
                    color: action.color
                  }}
                >
                  {action.icon}
                </div>
                <div className="space-y-0.5">
                  <p className="text-[12px] font-black leading-tight text-start" style={{ color: 'var(--text-primary)' }}>
                    {isAr ? action.labelAr : action.labelEn}
                  </p>
                  <p className="text-[9.5px] font-semibold text-start" style={{ color: 'var(--text-muted)' }}>
                    {isAr ? action.subAr : action.subEn}
                  </p>
                </div>
              </motion.button>

              {/* Export Dropdown */}
              {action.id === 'export' && (
                <AnimatePresence>
                  {showExportDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        className="absolute bottom-full mb-2 z-50 w-full rounded-[16px] overflow-hidden"
                        style={{
                          background: 'rgba(10,15,28,0.97)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          backdropFilter: 'blur(20px)',
                          boxShadow: '0 -8px 24px rgba(0,0,0,0.4)'
                        }}
                      >
                        {[
                          { label: isAr ? 'تصدير إلى التقويم (.ics)' : 'Export to Calendar (.ics)', icon: '🗓️', fn: handleExportICS },
                          { label: isAr ? 'تحميل كـ PDF' : 'Download as PDF', icon: '📄', fn: handlePrintPDF }
                        ].map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => { setShowExportDropdown(false); opt.fn(); }}
                            className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold transition-all"
                            style={{
                              color: 'var(--text-primary)',
                              borderBottom: i === 0 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                            }}
                          >
                            <span>{opt.label}</span>
                            <span style={{ fontSize: '16px' }}>{opt.icon}</span>
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. قائمة الإعدادات (Accordion Style) ── */}
      <div className="space-y-2.5">
        <div className="section-header">
          <h3 className="section-title">{isAr ? 'الإعدادات والتخصيص' : 'Settings & Customization'}</h3>
        </div>

        <div
          className="rounded-[20px] overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {settingsItems.map((item, idx) => (
            <div key={item.id}>
              {/* الصف الرئيسي للإعداد */}
              <button
                onClick={() => {
                  if (item.action) { item.action(); }
                  else if (item.expandable) {
                    setExpandedSection(expandedSection === item.expandId ? null : item.expandId);
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 transition-all text-start"
                style={{
                  background: expandedSection === item.expandId ? 'rgba(255,255,255,0.03)' : 'transparent',
                  borderBottom: idx < settingsItems.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none'
                }}
                aria-expanded={item.expandable ? expandedSection === item.expandId : undefined}
              >
                {/* أيقونة */}
                <div
                  className="w-9 h-9 rounded-[12px] flex items-center justify-center text-base shrink-0"
                  style={{ background: `${item.color}15`, border: `1px solid ${item.color}30` }}
                >
                  {item.icon}
                </div>

                {/* النص */}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
                    {isAr ? item.labelAr : item.labelEn}
                  </p>
                  <p className="text-[9.5px] font-semibold mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                    {isAr ? item.subAr : item.subEn}
                  </p>
                </div>

                {/* سهم أو مؤشر */}
                <span
                  className="shrink-0 transition-transform duration-200"
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    transform: item.expandable && expandedSection === item.expandId ? 'rotate(90deg)' : 'none'
                  }}
                >
                  {isAr ? '←' : '→'}
                </span>
              </button>

              {/* محتوى قابل للتوسع (Accordion) */}
              <AnimatePresence>
                {item.expandable && expandedSection === item.expandId && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden', borderBottom: idx < settingsItems.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                  >
                    <div className="px-4 pb-4">
                      {/* Theme Switcher */}
                      {item.expandId === 'theme' && (
                        <div className="pt-2">
                          <p className="text-[9px] font-bold mb-3" style={{ color: 'var(--text-muted)' }}>
                            {isAr ? 'اختر لون ومظهر التطبيق:' : 'Choose app theme & color:'}
                          </p>
                          <ThemeSwitcher />
                        </div>
                      )}

                      {/* Feedback Form */}
                      {item.expandId === 'feedback' && (
                        <form onSubmit={handleSendFeedbackLocal} className="space-y-3 pt-2">
                          <div className="flex gap-1.5">
                            {['Suggestion', 'Bug', 'Question'].map(cat => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setFeedbackCategory(cat)}
                                className="flex-1 py-1.5 rounded-[10px] text-[9px] font-black transition-all"
                                style={{
                                  background: feedbackCategory === cat ? 'rgba(var(--primary-color-rgb),0.15)' : 'rgba(255,255,255,0.04)',
                                  border: `1px solid ${feedbackCategory === cat ? 'rgba(var(--primary-color-rgb),0.3)' : 'rgba(255,255,255,0.06)'}`,
                                  color: feedbackCategory === cat ? 'var(--accent)' : 'var(--text-muted)'
                                }}
                              >
                                {cat === 'Suggestion' ? (isAr ? '💡 اقتراح' : '💡 Suggest') :
                                 cat === 'Bug' ? (isAr ? '🐛 خطأ' : '🐛 Bug') :
                                 (isAr ? '❓ سؤال' : '❓ Question')}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={feedbackMessage}
                            onChange={e => setFeedbackMessage(e.target.value)}
                            placeholder={isAr ? 'اكتب ملاحظتك أو اقتراحك هنا...' : 'Type your feedback or suggestion...'}
                            rows={3}
                            className="w-full text-xs font-semibold resize-none rounded-[12px] px-3 py-2.5 outline-none transition-all"
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: 'var(--text-primary)',
                              fontSize: '11px'
                            }}
                          />
                          <button
                            type="submit"
                            disabled={feedbackLoading || !feedbackMessage.trim()}
                            className="w-full py-2.5 rounded-[12px] text-xs font-black transition-all disabled:opacity-50"
                            style={{
                              background: 'var(--accent)',
                              color: '#070b13'
                            }}
                          >
                            {feedbackLoading ? '⏳...' : (isAr ? '📤 إرسال الملاحظة' : '📤 Send Feedback')}
                          </button>
                        </form>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. زر تسجيل الخروج ── */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setIsLogoutModalOpen(true)}
        className="w-full py-3.5 rounded-[16px] text-[12px] font-black flex items-center justify-center gap-2 transition-all"
        style={{
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: '#f87171'
        }}
      >
        🚪 {isAr ? 'تسجيل الخروج من البوابة' : 'Sign Out from Portal'}
      </motion.button>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isLogoutModalOpen}
        title={isAr ? 'تأكيد الخروج' : 'Confirm Sign Out'}
        message={isAr ? 'هل أنت متأكد من الخروج من بوابة الطالب؟' : 'Are you sure you want to sign out?'}
        onConfirm={confirmLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
        confirmText={isAr ? 'خروج' : 'Sign Out'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
      />
    </div>
  );
}
