/**
 * @file ProfileTab.jsx
 * @description تبويب الهوية الرقمية والملف الشخصي (Profile & Digital ID) في بوابة الطالب.
 * يتيح معاينة بطاقة الهوية الجامعية الذكية، وتغيير الإعدادات، واستعراض الخريطة التفاعلية، والمكتبة الرقمية، وإرسال الملاحظات للمطور.
 * @author أنتيجرافيتي (Antigravity)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UserSettings from '../../UserSettings';
import ThemeSwitcher from '../../ThemeSwitcher';
import ConfirmationModal from '../../ConfirmationModal';

/**
 * مكون الهوية الشخصية والأدوات الرقمية للطلاب.
 * 
 * الميزات:
 * 1. محاكاة بطاقة هوية جامعية رقمية ذكية تحتوي على الباركود المخصص ومؤشرات القسم والمستوى والشعبة.
 * 2. شبكة الأدوات السريعة (مشاركة الجدول، تنزيل ملفات ICS/PDF للتقويم، تشغيل محاكي التعديل، اختبار الإشعارات).
 * 3. قائمة الإعدادات الذكية التي تفتح النوافذ الفرعية:
 *    - تعديل بيانات الحساب وصورة الهوية والمظهر عبر `UserSettings`.
 *    - معاينة حالة اتصال الجلسة ومستمع الأحداث SSE الآمن.
 *    - دليل خريطة الحرم الجامعي التفاعلي بالـ SVG.
 *    - كتالوج المكتبة الرقمية الذي يستعرض كتب ومراجع المجموعة المقررة.
 *    - نموذج التواصل وإرسال الاقتراحات الفورية للمطور.
 * 
 * @param {Object} props - خصائص المكون.
 * @param {boolean} props.isAr - لغة واجهة المستخدم (عربي/إنجليزي).
 * @param {Object} props.profile - كائن بيانات الطالب الحالية من الذاكرة المحلية.
 * @param {Function} props.setProfile - دالة تحديث كائن الطالب في الحالة العليا.
 * @param {Object} props.systemSettings - كائن إعدادات النظام للتحكم في تفعيل أو تعطيل المكتبة والخريطة.
 * @param {boolean} props.sandboxMode - حالة وضع محاكي التعديل.
 * @param {Function} props.toggleSandboxFromButton - دالة تبديل وضع المحاكاة من زر الأدوات السريعة.
 * @param {Function} props.handleTestNotification - دالة اختبار إرسال إشعار محلي فوري.
 * @param {Function} props.handleCheckUpdates - دالة فحص وتطبيق تحديثات النظام الفورية.
 * @param {Function} props.handleExportICS - دالة استدعاء تصدير ملف التقويم الدراسي .ics.
 * @param {Function} props.handlePrintPDF - دالة استدعاء طباعة وتنزيل الجدول كـ PDF.
 * @param {Function} props.handleShareSchedule - دالة استدعاء مشاركة كود/نص الجدول الدراسي.
 * @param {Function} props.confirmLogout - دالة تأكيد تسجيل الخروج وتطهير الجلسة.
 * @param {Array<Object>} props.allAlerts - مصفوفة الإشعارات العامة.
 * @param {Function} props.fetchData - دالة إعادة تحميل الجداول وتحديث الحالة العامة.
 * @param {Function} props.t - دالة الترجمة للغات (i18next).
 */
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
  // ── الحالات المحلية الفرعية للملف الشخصي ──
  const [profileViewMode, setProfileViewMode] = useState('main'); // 'main' | 'edit' | 'feedback' | 'library' | 'map'
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // حالات نموذج الاقتراحات والملاحظات
  const [feedbackCategory, setFeedbackCategory] = useState('Suggestion');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  /**
   * معالج إرسال نموذج الملاحظات والاقتراحات للمطور.
   * @param {React.FormEvent} e - حدث إرسال النموذج.
   */
  const handleSendFeedbackLocal = async (e) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;
    setFeedbackLoading(true);
    try {
      // استدعاء دالة المعالجة الخارجية المرفقة
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
      if (data.success) {
        toast.success(t('feedback.successMsg') || (isAr ? 'تم إرسال اقتراحك بنجاح للمطور!' : 'Feedback sent successfully!'));
        setFeedbackMessage('');
      } else {
        throw new Error(data.error || 'API Error');
      }
    } catch (err) {
      toast.error(isAr ? 'فشل إرسال الملاحظات. يرجى التحقق من اتصال الشبكة.' : 'Failed to send feedback');
    } finally {
      setFeedbackLoading(false);
    }
  };

  // ── معاينة نموذج الاقتراحات ──
  const renderFeedbackView = () => {
    return (
      <div className="space-y-5">
        <div className="w-full max-w-md flex items-center justify-between pb-3 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setProfileViewMode('main')}
            className="px-3.5 py-2 text-xs font-black uppercase border border-slate-800 hover:border-emerald-400 hover:text-black hover:bg-emerald-400 bg-white/5 rounded-xl transition-all flex items-center gap-1.5"
          >
            <span>{isAr ? '← عودة' : '← Back'}</span>
          </button>
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono">
            {t('feedback.title')}
          </span>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-850 p-5 shadow-xl text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-slate-955 border border-white/10 flex items-center justify-center text-xl shadow-inner shrink-0">
              👨‍💻
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-emerald-400 leading-none">
                {t('feedback.devInfo')}
              </p>
              <h3 className="text-sm font-black text-white mt-1.5">Mohammed Ghaleb Al-Osimi</h3>
              <p className="text-[9px] text-slate-500 font-bold mt-0.5 font-mono">Full-Stack Engineer & Architect</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-4 leading-relaxed font-semibold">
            {t('feedback.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSendFeedbackLocal} className="bg-slate-900 border border-slate-850 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block font-mono">
              {t('feedback.categoryLabel')}
            </label>
            <select
              value={feedbackCategory}
              onChange={e => setFeedbackCategory(e.target.value)}
              className="w-full px-3.5 font-bold cursor-pointer bg-slate-955 text-white rounded-xl border border-white/10"
              style={{ height: '48px' }}
            >
              <option value="Suggestion" className="bg-slate-955 text-white">{t('feedback.catFeature')}</option>
              <option value="Bug" className="bg-slate-955 text-white">{t('feedback.catBug')}</option>
              <option value="General" className="bg-slate-955 text-white">{t('feedback.catGeneral')}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block font-mono">
              {t('feedback.msgLabel')}
            </label>
            <textarea
              required
              rows="5"
              value={feedbackMessage}
              onChange={e => setFeedbackMessage(e.target.value)}
              placeholder={t('feedback.msgPlaceholder')}
              className="w-full p-4 text-xs font-semibold text-white bg-slate-955 border border-white/10 rounded-2xl focus:outline-none focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={feedbackLoading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-955 font-black text-xs tracking-wider rounded-xl transition-all h-[52px]"
          >
            {feedbackLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                {t('feedback.submitLoading')}
              </span>
            ) : (
              `🚀 ${t('feedback.submitBtn')}`
            )}
          </button>
        </form>
      </div>
    );
  };

  // ── معاينة خريطة الحرم الجامعي التفاعلية ──
  const renderMapView = () => {
    return (
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-3xl frosted-panel p-5 shadow-2xl backdrop-blur-md border border-white/5 bg-slate-900/40">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-black text-white">{isAr ? 'خريطة الحرم الجامعي' : 'Campus Navigator'}</h3>
              <p className="text-[9px] text-slate-400 font-bold mt-0.5">{isAr ? 'جامعة المنار - المبنى الرئيسي' : 'AL-MANAR UNIVERSITY - MAIN CAMPUS'}</p>
            </div>
            <span className="text-xs bg-[#2979ff]/10 border border-[#2979ff]/25 px-2.5 py-0.5 rounded-full text-[#2979ff] font-bold">
              {isAr ? 'تفاعلي' : 'Interactive'}
            </span>
          </div>
          <div className="bg-slate-955 border border-white/5 rounded-2xl p-4 flex items-center justify-center relative overflow-hidden shadow-inner" style={{ minHeight: '220px' }}>
            <svg className="w-full h-full max-h-[200px]" viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 0,40 L 400,40 M 0,80 L 400,80 M 0,120 L 400,120 M 0,160 L 400,160 M 0,200 L 400,200 M 40,0 L 40,240 M 80,0 L 80,240 M 120,0 L 120,240 M 160,0 L 160,240 M 200,0 L 200,240 M 240,0 L 240,240 M 280,0 L 280,240 M 320,0 L 320,240 M 360,0 L 360,240" stroke="rgba(255,255,255,0.02)" strokeWidth="1"/>
              <path d="M 40,120 L 360,120 M 200,40 L 200,200" stroke="rgba(41, 121, 255, 0.15)" strokeWidth="12" strokeLinecap="round"/>
              <rect x="60" y="45" width="90" height="50" rx="8" fill="rgba(19, 27, 46, 0.85)" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5"/>
              <text x="105" y="75" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle">{isAr ? 'مبنى أ - المحاضرات' : 'Hall A - Lectures'}</text>
              
              <rect x="250" y="45" width="90" height="50" rx="8" fill="rgba(19, 27, 46, 0.85)" stroke="var(--accent-glow)" strokeWidth="1.5"/>
              <text x="295" y="75" fill="var(--accent)" fontSize="8" fontWeight="bold" textAnchor="middle">{isAr ? 'مبنى ب - المعامل' : 'Computer Labs'}</text>
              
              <rect x="60" y="145" width="90" height="50" rx="8" fill="rgba(19, 27, 46, 0.85)" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5"/>
              <text x="105" y="175" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle">{isAr ? 'المكتبة المركزية' : 'Central Library'}</text>
              
              <rect x="250" y="145" width="90" height="50" rx="8" fill="rgba(19, 27, 46, 0.85)" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5"/>
              <text x="295" y="175" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle">{isAr ? 'الخدمات الطلابية' : 'Student Hub'}</text>

              <g transform="translate(192, 112)">
                <circle cx="8" cy="8" r="8" fill="#ff1744" opacity="0.2"/>
                <circle cx="8" cy="8" r="4" fill="#ff1744"/>
                <text x="8" y="-4" fill="#ff1744" fontSize="7" fontWeight="bold" textAnchor="middle">{isAr ? 'أنت هنا' : 'You are here'}</text>
              </g>
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {[
              { name: isAr ? 'مبنى أ (القاعات)' : 'Building A (Halls)', status: isAr ? 'مفتوح' : 'Open', color: 'text-emerald-400' },
              { name: isAr ? 'مختبرات الحاسوب' : 'Computer Labs', status: isAr ? 'حصة نشطة الآن' : 'Session Live Now', color: 'text-[var(--accent)]' },
              { name: isAr ? 'المكتبة' : 'Library Hub', status: isAr ? 'مفتوح حتى 8 م' : 'Open until 8 PM', color: 'text-emerald-400' },
              { name: isAr ? 'مبنى الإدارة' : 'Administration', status: isAr ? 'مغلق' : 'Closed', color: 'text-red-400' },
            ].map((b, i) => (
              <div key={i} className="p-3 bg-white/3 border border-white/5 rounded-xl text-[10px] font-bold">
                <span className="text-white block">{b.name}</span>
                <span className={`block mt-1 font-mono text-[9px] ${b.color}`}>{b.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── معاينة كتب ومراجع المكتبة الرقمية ──
  const renderLibraryView = () => {
    return (
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-3xl frosted-panel p-5 shadow-2xl backdrop-blur-md border border-white/5 bg-slate-900/40">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-black text-white">{isAr ? 'المكتبة الرقمية' : 'Digital Library'}</h3>
              <p className="text-[9px] text-slate-400 font-bold mt-0.5">{isAr ? 'الكتب والمراجع الدراسية المتوفرة' : 'Assigned textbooks & resources'}</p>
            </div>
            <span className="text-xs bg-[#2979ff]/10 border border-[#2979ff]/25 px-2.5 py-0.5 rounded-full text-[#2979ff] font-bold">
              {isAr ? 'نشط' : 'Online'}
            </span>
          </div>
          <div className="relative mb-4">
            <input
              type="text"
              readOnly
              placeholder={isAr ? 'ابحث عن مراجع، كتب، أو أبحاث...' : 'Search textbooks, papers, resources...'}
              className="w-full bg-slate-955 border border-white/5 rounded-xl p-3 text-xs text-slate-350 focus:outline-none cursor-not-allowed font-medium"
            />
            <span className="absolute right-3.5 top-3.5 text-xs text-slate-500">🔍</span>
          </div>
          <div className="space-y-3">
            {[
              { title: 'Artificial Intelligence: A Modern Approach', code: 'CS 401', status: isAr ? 'متوفر رقمياً' : 'Available PDF', color: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' },
              { title: 'Calculus: Early Transcendentals', code: 'MAT 302', status: isAr ? 'مستعار (تاريخ الإرجاع: 20 سبتمبر)' : 'Borrowed (Due Sep 20)', color: 'bg-amber-500/10 border-amber-500/25 text-amber-400' },
              { title: 'A History of the Modern World', code: 'HIS 101', status: isAr ? 'متوفر رقمياً' : 'Available PDF', color: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' },
            ].map((book, i) => (
              <div key={i} className="p-3.5 bg-white/3 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[8px] font-mono text-[#2979ff] font-black uppercase tracking-wider">{book.code}</span>
                  <span className="text-xs font-black text-white mt-1 block truncate leading-tight">{book.title}</span>
                  <span className="text-[9px] text-slate-405 font-bold mt-0.5 block">{isAr ? 'الناشر: بيرسون إديوكيشن' : 'Publisher: Pearson Education'}</span>
                </div>
                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${book.color}`}>
                  {book.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // تبديل شاشات العرض الفرعية بناءً على الحالة الحالية
  if (profileViewMode === 'edit') {
    return (
      <UserSettings
        onClose={() => {
          setProfileViewMode('main');
          const saved = localStorage.getItem('student_profile');
          if (saved) {
            try { 
              setProfile(JSON.parse(saved)); 
              fetchData(true); // إعادة تحميل البيانات لتحديث منبهات التنبيه
            } catch {}
          }
        }}
      />
    );
  }

  if (profileViewMode === 'library') {
    return (
      <div className="space-y-5">
        <div className="w-full max-w-md flex items-center justify-between pb-3 border-b border-white/5">
          <button
            type="button"
            onClick={() => setProfileViewMode('main')}
            className="px-3.5 py-2 text-xs font-black uppercase border border-white/5 hover:bg-[var(--accent)] hover:text-black bg-white/5 rounded-xl transition-all flex items-center gap-1.5"
          >
            <span>{isAr ? '← عودة' : '← Back'}</span>
          </button>
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono">
            {isAr ? 'المكتبة الرقمية' : 'Digital Library'}
          </span>
        </div>
        {renderLibraryView()}
      </div>
    );
  }

  if (profileViewMode === 'map') {
    return (
      <div className="space-y-5">
        <div className="w-full max-w-md flex items-center justify-between pb-3 border-b border-white/5">
          <button
            type="button"
            onClick={() => setProfileViewMode('main')}
            className="px-3.5 py-2 text-xs font-black uppercase border border-white/5 hover:bg-[var(--accent)] hover:text-black bg-white/5 rounded-xl transition-all flex items-center gap-1.5"
          >
            <span>{isAr ? '← عودة' : '← Back'}</span>
          </button>
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono">
            {isAr ? 'خريطة الحرم الجامعي' : 'Campus Map'}
          </span>
        </div>
        {renderMapView()}
      </div>
    );
  }

  if (profileViewMode === 'feedback') {
    return renderFeedbackView();
  }

  return (
    <div className="space-y-5">
      {/* ── لوحة بطاقة الهوية الجامعية الرقمية التفاعلية ── */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 shadow-2xl text-white border"
        style={{
          background: 'linear-gradient(135deg, rgba(13, 18, 30, 0.95) 0%, rgba(5, 8, 15, 0.98) 100%)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.15)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}
      >
        <div className="absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ backgroundColor: 'var(--accent, #10b981)' }} />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full blur-2xl opacity-15 pointer-events-none" style={{ backgroundColor: 'var(--accent, #10b981)' }} />
        
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <p className="text-[9px] font-black tracking-widest text-[var(--accent)] uppercase opacity-90">
              {isAr ? 'جامعة المنار الأهلية' : 'AL-MANAR UNIVERSITY'}
            </p>
            <p className="text-[8px] font-bold text-slate-400 tracking-wider">
              {isAr ? 'بطاقة الهوية الأكاديمية الرقمية' : 'OFFICIAL STUDENT CARD'}
            </p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-lg shadow-inner shrink-0">
            🎓
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="w-16 h-16 rounded-2xl border-2 border-[var(--accent)]/30 shadow-lg shrink-0 bg-slate-900 flex items-center justify-center font-black text-sm text-[var(--accent)]">
            {profile.name ? profile.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white truncate leading-tight">
              {profile.name || (isAr ? 'طالب منار' : 'Manar Student')}
            </p>
            <p className="text-[10px] font-bold text-[var(--accent)] mt-1.5 truncate">
              {profile.department || (isAr ? 'هندسة البرمجيات' : 'Software Engineering')}
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5 font-bold">
              {(isAr ? 'مستوى ' : 'Level ') + (profile.level || '1')} · {profile.groupName || 'Group A'}
            </p>
          </div>
        </div>

        {/* رسم باركود الهوية */}
        <div className="mt-5 space-y-1.5">
          <div className="bg-white p-2 flex flex-col items-center justify-center shadow-inner rounded-xl">
            <div className="flex items-center justify-center gap-[1.5px] w-full">
              {[1, 3, 1, 2, 4, 1, 3, 2, 1, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 1, 4, 1, 2, 1, 3].map((width, idx) => (
                <div
                  key={idx}
                  className="bg-black h-7 shrink-0"
                  style={{ width: `${width}px` }}
                />
              ))}
            </div>
            <p className="text-[8px] font-mono tracking-widest text-slate-800 font-extrabold mt-1">
              *STU-{profile.groupId || '101'}-{String(profile.name || 'student').substring(0, 3).toUpperCase()}*
            </p>
          </div>
        </div>
      </div>

      {/* ── شبكة الأدوات السريعة ── */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        {/* تصدير الجدول */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -2 }}
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            className="w-full h-full frosted-panel rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 transition-all duration-300 border border-white/5 bg-white/2 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:border-blue-500/30"
          >
            <span className="text-2xl leading-none">📅</span>
            <div>
              <span className="text-[11px] font-black block text-white leading-tight">{isAr ? 'تصدير الجدول' : 'Export Schedule'}</span>
              <span className="text-[9px] text-slate-500 block mt-0.5 font-bold">{isAr ? 'تنزيل كـ ICS أو PDF' : 'Download as ICS or PDF'}</span>
            </div>
          </motion.button>
          
          <AnimatePresence>
            {showExportDropdown && (
              <>
                <div className="fixed inset-0 z-45" onClick={() => setShowExportDropdown(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full mb-2 left-0 right-0 z-50 rounded-2xl border border-white/10 p-2 shadow-2xl space-y-1 text-xs"
                  style={{
                    background: 'linear-gradient(135deg, rgba(13, 18, 30, 0.98) 0%, rgba(5, 8, 15, 0.99) 100%)',
                    backdropFilter: 'blur(20px)'
                  }}
                >
                  <button
                    onClick={() => {
                      setShowExportDropdown(false);
                      handleExportICS();
                    }}
                    className="w-full text-right py-2.5 px-3 hover:bg-white/5 rounded-xl text-slate-200 hover:text-white flex items-center justify-between font-bold transition-all"
                  >
                    <span>{isAr ? 'تصدير إلى التقويم (.ics)' : 'Export to Calendar (.ics)'}</span>
                    <span>🗓️</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowExportDropdown(false);
                      handlePrintPDF();
                    }}
                    className="w-full text-right py-2.5 px-3 hover:bg-white/5 rounded-xl text-slate-200 hover:text-white flex items-center justify-between font-bold transition-all"
                  >
                    <span>{isAr ? 'تحميل كـ PDF (طباعة)' : 'Download as PDF'}</span>
                    <span>📄</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* مشاركة الجدول */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ y: -2 }}
          onClick={handleShareSchedule}
          className="frosted-panel rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 transition-all duration-300 border border-white/5 bg-white/2 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] hover:border-violet-500/30"
        >
          <span className="text-2xl leading-none">📤</span>
          <div>
            <span className="text-[11px] font-black block text-white leading-tight">{isAr ? 'مشاركة الجدول' : 'Share Schedule'}</span>
            <span className="text-[9px] text-slate-500 block mt-0.5 font-bold">{isAr ? (navigator.share ? 'مشاركة فورية' : 'نسخ للحافظة') : 'Share / Copy'}</span>
          </div>
        </motion.button>

        {/* محاكي التعديل الافتراضي */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ y: -2 }}
          onClick={toggleSandboxFromButton}
          className={`frosted-panel rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 transition-all duration-300 border ${
            sandboxMode 
              ? 'border-amber-500/50 bg-amber-500/5 shadow-[0_0_16px_rgba(245,158,11,0.15)]' 
              : 'border-white/5 bg-white/2 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:border-amber-500/30'
          }`}
        >
          <span className="text-2xl leading-none">{sandboxMode ? '🔄' : '🧪'}</span>
          <div>
            <span className="text-[11px] font-black block text-white leading-tight">
              {sandboxMode ? (isAr ? 'إنهاء المحاكاة' : 'Exit Simulator') : (isAr ? 'محاكي التعديل' : 'Reschedule Sim')}
            </span>
            <span className="text-[9px] text-slate-500 block mt-0.5 font-bold">
              {sandboxMode ? (isAr ? 'استعادة الجدول' : 'Restore timetable') : (isAr ? 'تجربة تعديل محلية' : 'Local simulation')}
            </span>
          </div>
        </motion.button>

        {/* اختبار إشعارات الدفع */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ y: -2 }}
          onClick={handleTestNotification}
          className="frosted-panel rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 transition-all duration-300 border border-white/5 bg-white/2 hover:shadow-[0_0_20px_rgba(234,179,8,0.15)] hover:border-yellow-500/30"
        >
          <span className="text-2xl leading-none">🔔</span>
          <div>
            <span className="text-[11px] font-black block text-white leading-tight">{isAr ? 'اختبار التنبيه' : 'Test Notification'}</span>
            <span className="text-[9px] text-slate-500 block mt-0.5 font-bold">{isAr ? 'إرسال تنبيه تجريبي' : 'Send mock push alert'}</span>
          </div>
        </motion.button>
      </div>

      {/* ── القائمة الشاملة للإعدادات والأدوات ── */}
      <div className="frosted-panel rounded-3xl overflow-hidden divide-y divide-white/5">
        {/* الصف 1: تعديل بيانات الحساب */}
        <button
          onClick={() => setProfileViewMode('edit')}
          className="w-full flex items-center justify-between p-4 hover:bg-[var(--accent-dim)] transition-colors text-right"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">👤</span>
            <div className="text-right">
              <p className="text-xs font-black text-[var(--text-primary)]">{isAr ? 'تعديل الحساب وإعدادات المظهر والمنبه' : 'Account & Alert Settings'}</p>
              <p className="text-[9px] text-slate-500 font-bold">{isAr ? 'تعديل البيانات الدراسية، الصورة الشخصية، التنبيهات، وكلمة المرور' : 'Edit profile info, academic details, alerts & password'}</p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-bold">{isAr ? '←' : '→'}</span>
        </button>

        {/* الصف 2: مظهر الألوان المخصصة */}
        <div className="w-full flex items-center justify-between p-4 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-lg">🎨</span>
            <div className="text-right">
              <p className="text-xs font-black text-[var(--text-primary)]">{isAr ? 'مظهر الألوان المخصصة' : 'Appearance Customization'}</p>
              <p className="text-[9px] text-slate-500 font-bold">{isAr ? 'تخصيص ألوان بوابة الطالب والمظهر والخطوط' : 'Customize portal accent colors, fonts & theme mode'}</p>
            </div>
          </div>
          <ThemeSwitcher />
        </div>

        {/* الصف 3: الأمان وحالة الجلسة */}
        <div className="w-full">
          <button
            onClick={() => setShowSecurityDetails(!showSecurityDetails)}
            className="w-full flex items-center justify-between p-4 hover:bg-[var(--accent-dim)] transition-colors text-right"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🔒</span>
              <div className="text-right">
                <p className="text-xs font-black text-[var(--text-primary)]">{isAr ? 'الحماية والأمان للجلسة' : 'Security & Session'}</p>
                <p className="text-[9px] text-slate-500 font-bold">{isAr ? 'حالة التوثيق ومفاتيح الاتصال النشطة' : 'Security connection keys & session state'}</p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-bold">{showSecurityDetails ? '▲' : '▼'}</span>
          </button>
          
          <AnimatePresence>
            {showSecurityDetails && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden bg-slate-950/40 text-xs text-slate-300"
              >
                <div className="p-4 space-y-2.5 font-bold font-mono border-t border-white/5">
                  <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                    <span className="text-slate-550">{isAr ? 'حالة الجلسة:' : 'Session Connection:'}</span>
                    <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[9px] uppercase tracking-wide">
                      {isAr ? 'مشفر وآمن' : 'Secured (SSL)'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span className="text-slate-550">{isAr ? 'مستمع SSE المباشر:' : 'SSE Real-Time Sync:'}</span>
                    <span className="text-emerald-400 font-extrabold">{isAr ? 'نشط ومتصل' : 'Active'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-550">{isAr ? 'تاريخ انتهاء الصلاحية:' : 'Session Expiry:'}</span>
                    <span className="text-slate-400 text-[10px]">2026-06-30</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* الصف 4: المكتبة الرقمية */}
        {systemSettings.disableLibrary === false && (
          <button
            onClick={() => setProfileViewMode('library')}
            className="w-full flex items-center justify-between p-4 hover:bg-[var(--accent-dim)] transition-colors text-right"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📚</span>
              <div className="text-right">
                <p className="text-xs font-black text-[var(--text-primary)]">{isAr ? 'المكتبة الرقمية' : 'Digital Library'}</p>
                <p className="text-[9px] text-slate-500 font-bold">{isAr ? 'تصفح الكتب والمراجع الدراسية المقررة لشعبتك' : 'Browse course textbooks & reference catalog'}</p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-bold">{isAr ? '←' : '→'}</span>
          </button>
        )}

        {/* الصف 5: خريطة الحرم */}
        {systemSettings.disableMap === false && (
          <button
            onClick={() => setProfileViewMode('map')}
            className="w-full flex items-center justify-between p-4 hover:bg-[var(--accent-dim)] transition-colors text-right"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🗺️</span>
              <div className="text-right">
                <p className="text-xs font-black text-[var(--text-primary)]">{isAr ? 'خريطة الحرم الجامعي' : 'Campus Map'}</p>
                <p className="text-[9px] text-slate-500 font-bold">{isAr ? 'دليل قاعات ومباني الكلية التفاعلي' : 'Interactive campus map navigator'}</p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-bold">{isAr ? '←' : '→'}</span>
          </button>
        )}

        {/* الصف 6: مركز الاقتراحات والتواصل */}
        <button
          onClick={() => setProfileViewMode('feedback')}
          className="w-full flex items-center justify-between p-4 hover:bg-[var(--accent-dim)] transition-colors text-right"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">💡</span>
            <div className="text-right">
              <p className="text-xs font-black text-[var(--text-primary)]">{isAr ? 'مركز التواصل والاقتراحات للمطور' : 'Suggestions & Contact Hub'}</p>
              <p className="text-[9px] text-slate-500 font-bold">{isAr ? 'راسل المطور أو اقترح ميزات جديدة لتطوير النظام' : 'Contact developer directly or suggest features'}</p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-bold">{isAr ? '←' : '→'}</span>
        </button>
      </div>

      {/* ── أندرويد وتسجيل الخروج ── */}
      <div className="space-y-3 pt-2">
        {/* تنزيل APK الأندرويد */}
        <a
          href="/Manar_Schedule.apk"
          download
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-[var(--accent-dim)] border border-[var(--accent-glow)] hover:bg-[var(--accent)] hover:text-black text-[var(--accent)] rounded-xl text-xs font-black transition-all duration-200 text-center"
          style={{ textDecoration: 'none' }}
        >
          <span>🤖</span>
          <span>{isAr ? 'تنزيل تطبيق الأندرويد (APK)' : 'Download Android App (APK)'}</span>
        </a>

        {/* التحقق من التحديثات */}
        <button
          type="button"
          onClick={handleCheckUpdates}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-white/4 border border-white/8 hover:bg-white/8 hover:border-white/15 text-white rounded-xl text-xs font-black transition-all duration-200"
        >
          <span>📥</span>
          <span>{isAr ? 'التحقق من التحديثات وتحديث البوابة' : 'Check for System Updates'}</span>
        </button>

        {/* تسجيل الخروج */}
        <button
          onClick={() => setIsLogoutModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-red-500/5 border border-red-500/10 hover:bg-red-500/15 text-red-400 rounded-xl text-xs font-black transition-all duration-200"
        >
          <span>🚪</span>
          <span>{isAr ? 'تسجيل الخروج وإنهاء الجلسة' : 'Sign Out of Portal'}</span>
        </button>
      </div>

      {/* تأكيد الخروج (Logout Dialog Modal) */}
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
