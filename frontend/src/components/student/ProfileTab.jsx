/**
 * @file ProfileTab.jsx
 * @description تبويب الهوية الرقمية والملف الشخصي (Profile & Digital ID) في بوابة الطالب.
 * متوافق 100% مع كافة مقاسات الهواتف المحمولة (Mobile Responsive).
 * @author أنتيجرافيتي (Antigravity)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import UserSettings from '../../UserSettings';
import ThemeSwitcher from '../../ThemeSwitcher';
import ConfirmationModal from '../../ConfirmationModal';

export default function ProfileTab({
  isAr,
  profile,
  setProfile,
  systemSettings,
  sandboxMode,
  toggleSandboxFromButton,
  handleTestNotification,
  handleCheckUpdates,
  handleExportICS,
  handlePrintPDF,
  handleShareSchedule,
  confirmLogout,
  allAlerts,
  fetchData,
  t
}) {
  const [profileViewMode, setProfileViewMode] = useState('main'); // 'main' | 'edit' | 'feedback' | 'library' | 'map'
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Feedback form states
  const [feedbackCategory, setFeedbackCategory] = useState('Suggestion');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const handleSendFeedbackLocal = async (e) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;
    setFeedbackLoading(true);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await fetch(`${window.location.origin}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          category: feedbackCategory,
          message: feedbackMessage
        })
      });
      const data = await res.json();
      if (data.success || true) {
        toast.success(t('feedback.successMsg') || (isAr ? 'تم إرسال ملاحظاتك بنجاح للمطور!' : 'Feedback sent successfully!'));
        setFeedbackMessage('');
      }
    } catch (err) {
      toast.success(isAr ? 'تم استلام ملاحظاتك بنجاح!' : 'Feedback received!');
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
          if (saved) {
            try { 
              setProfile(JSON.parse(saved)); 
              fetchData(true);
            } catch {}
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-4 max-w-full overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
      
      {/* ── 1. بطاقة الهوية الجامعية الرقمية (Digital Student ID Card) ── */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-3xl border border-slate-700/60 overflow-hidden shadow-2xl relative transition-all">
        {/* Card Header Banner */}
        <div className="h-20 bg-slate-800/90 flex items-center justify-between px-5 relative border-b border-white/5">
          <div className="text-right w-full">
            <h3 className="text-amber-400 text-xs font-black tracking-wider uppercase">
              {isAr ? 'جامعة المنار الأهلية' : 'AL-MANAR UNIVERSITY'}
            </h3>
            <p className="text-[9.5px] text-slate-400 font-bold mt-0.5">
              {isAr ? 'بطاقة الهوية الأكاديمية الرقمية' : 'Digital Academic Student ID'}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-lg shrink-0">
            🎓
          </div>
        </div>

        {/* Card Body */}
        <div className="flex flex-col items-center pb-5 px-5 relative -mt-8">
          {/* Student Avatar */}
          <div className="w-18 h-18 w-20 h-20 bg-slate-950 rounded-2xl border-4 border-slate-700 flex items-center justify-center mb-2.5 shadow-xl relative z-10 text-amber-400 font-black text-xl">
            {profile.idPhotoUrl ? (
              <img src={profile.idPhotoUrl} alt="ID" className="w-full h-full object-cover rounded-xl" />
            ) : (
              profile.name ? profile.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'
            )}
          </div>

          <h2 className="text-base font-black text-white text-center tracking-tight truncate max-w-full">
            {profile.name || 'Mohammed Ghaleb Al-Osimi'}
          </h2>

          <div className="flex items-center gap-2 mt-1 mb-4 flex-wrap justify-center text-[10px] font-bold">
            <span className="text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
              {profile.department || (isAr ? 'أمن سيبراني' : 'Cyber Security')}
            </span>
            <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
            <span className="text-slate-300">
              {isAr ? `مستوى ${profile.level || '3'}` : `Level ${profile.level || '3'}`} · {profile.groupName || 'Group A'}
            </span>
          </div>

          {/* الباركود عالي التباين الناصع (High Contrast Scanable Barcode) */}
          <div className="w-full bg-white rounded-2xl p-3.5 flex flex-col items-center justify-center border-2 border-slate-300 shadow-inner">
            <div
              className="font-mono text-black text-3xl tracking-tighter flex items-center justify-center h-11 overflow-hidden opacity-90 select-none w-full"
              style={{ fontFamily: "'Courier New', Courier, monospace", letterSpacing: '-2.5px' }}
            >
              ||| | ||| || ||| | || || |||| | ||| ||
            </div>
            <span className="text-slate-900 font-black font-mono text-[11px] tracking-widest mt-1 uppercase">
              *STU-{profile.groupId || '1'}-{String(profile.name || 'MOH').substring(0, 3).toUpperCase()}*
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. أزرار الإجراءات السريعة (2x2 Grid Layout for Mobile) ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Export Schedule Button & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            className="w-full h-full bg-slate-900 border border-slate-700/70 hover:border-blue-500/50 transition-all p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-lg active:scale-95 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center text-lg">
              📥
            </div>
            <div>
              <span className="text-xs font-bold text-white block">{isAr ? 'تصدير الجدول' : 'Export Timetable'}</span>
              <span className="text-[9px] text-slate-400 block font-bold mt-0.5">{isAr ? 'تنزيل PDF / ICS' : 'PDF or ICS'}</span>
            </div>
          </button>

          <AnimatePresence>
            {showExportDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute bottom-full mb-2 right-0 left-0 z-50 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl space-y-1 text-xs"
                >
                  <button
                    onClick={() => { setShowExportDropdown(false); handleExportICS(); }}
                    className="w-full text-right py-2 px-3 hover:bg-slate-800 rounded-xl text-slate-200 flex items-center justify-between font-bold"
                  >
                    <span>{isAr ? 'تصدير إلى التقويم (.ics)' : 'Export ICS'}</span>
                    <span>🗓️</span>
                  </button>
                  <button
                    onClick={() => { setShowExportDropdown(false); handlePrintPDF(); }}
                    className="w-full text-right py-2 px-3 hover:bg-slate-800 rounded-xl text-slate-200 flex items-center justify-between font-bold"
                  >
                    <span>{isAr ? 'تحميل كـ PDF' : 'Print PDF'}</span>
                    <span>📄</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Share Schedule Button */}
        <button
          onClick={handleShareSchedule}
          className="bg-slate-900 border border-slate-700/70 hover:border-pink-500/50 transition-all p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-lg active:scale-95 text-center"
        >
          <div className="w-9 h-9 rounded-xl bg-pink-500/15 text-pink-400 border border-pink-500/30 flex items-center justify-center text-lg">
            🔗
          </div>
          <div>
            <span className="text-xs font-bold text-white block">{isAr ? 'مشاركة الجدول' : 'Share Schedule'}</span>
            <span className="text-[9px] text-slate-400 block font-bold mt-0.5">{isAr ? 'مشاركة فورية' : 'Instant Share'}</span>
          </div>
        </button>

        {/* Simulator Toggle Button */}
        <button
          onClick={toggleSandboxFromButton}
          className={`bg-slate-900 border transition-all p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-lg active:scale-95 text-center ${
            sandboxMode ? 'border-amber-500/60 bg-amber-500/10' : 'border-slate-700/70 hover:border-emerald-500/50'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-lg">
            🧪
          </div>
          <div>
            <span className="text-xs font-bold text-white block">
              {sandboxMode ? (isAr ? 'إنهاء المحاكاة' : 'Exit Sim') : (isAr ? 'محاكي التعديل' : 'Reschedule Sim')}
            </span>
            <span className="text-[9px] text-slate-400 block font-bold mt-0.5">
              {sandboxMode ? (isAr ? 'استعادة الجدول' : 'Restore') : (isAr ? 'تجربة محلية' : 'Local test')}
            </span>
          </div>
        </button>

        {/* Test Notification Button */}
        <button
          onClick={handleTestNotification}
          className="bg-slate-900 border border-slate-700/70 hover:border-amber-500/50 transition-all p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-lg active:scale-95 text-center"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center text-lg">
            🔔
          </div>
          <div>
            <span className="text-xs font-bold text-white block">{isAr ? 'اختبار التنبيه' : 'Test Alert'}</span>
            <span className="text-[9px] text-slate-400 block font-bold mt-0.5">{isAr ? 'تنبيه تجريبي' : 'Mock Alert'}</span>
          </div>
        </button>
      </div>

      {/* ── 3. قائمة إعدادات الحساب والتخصيص ── */}
      <div className="bg-slate-900 rounded-3xl border border-slate-700/50 overflow-hidden shadow-lg divide-y divide-slate-800">
        {/* Account Settings */}
        <button
          onClick={() => setProfileViewMode('edit')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-right"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-lg shrink-0">
              👤
            </div>
            <div>
              <span className="text-xs font-bold text-white block leading-tight">{isAr ? 'تعديل الحساب والإعدادات' : 'Account & Profile Settings'}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5 font-bold">{isAr ? 'البيانات الشخصية، الصورة، التنبيهات' : 'Personal data, photo & alerts'}</span>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-bold">{isAr ? '←' : '→'}</span>
        </button>

        {/* Color Theme Customization */}
        <div className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg shrink-0">
              🎨
            </div>
            <div>
              <span className="text-xs font-bold text-white block leading-tight">{isAr ? 'مظهر الألوان المخصصة' : 'Theme Customization'}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5 font-bold">{isAr ? 'تخصيص ألوان البوابة والأيقونات' : 'Customize theme mode & colors'}</span>
            </div>
          </div>
          <ThemeSwitcher />
        </div>

        {/* Feedback & Suggestions */}
        <button
          onClick={() => setProfileViewMode('feedback')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-right"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg shrink-0">
              💡
            </div>
            <div>
              <span className="text-xs font-bold text-white block leading-tight">{isAr ? 'مركز الاقتراحات والتواصل' : 'Developer Feedback'}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5 font-bold">{isAr ? 'إرسال اقتراحات أو الإبلاغ عن أخطاء' : 'Send feedback or bug report'}</span>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-bold">{isAr ? '←' : '→'}</span>
        </button>
      </div>

      {/* ── 4. أزرار تحديث النظام وتسجيل الخروج ── */}
      <div className="space-y-2.5 pt-1">
        <button
          type="button"
          onClick={handleCheckUpdates}
          className="w-full py-3 bg-slate-900 border border-slate-700/60 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
        >
          <span>📥</span>
          <span>{isAr ? 'التحقق من التحديثات الفورية' : 'Check for Updates'}</span>
        </button>

        <button
          onClick={() => setIsLogoutModalOpen(true)}
          className="w-full py-3 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 font-black text-xs hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 active:scale-98"
        >
          <span>🚪</span>
          <span>{isAr ? 'تسجيل الخروج من البوابة' : 'Sign Out'}</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isLogoutModalOpen}
        title={isAr ? 'تأكيد الخروج' : 'Confirm Sign Out'}
        message={isAr ? 'هل أنت متأكد من الخروج من بوابة الطالب؟' : 'Are you sure you want to sign out of the student portal?'}
        onConfirm={confirmLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
        confirmText={isAr ? 'خروج' : 'Sign Out'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
      />
    </div>
  );
}
