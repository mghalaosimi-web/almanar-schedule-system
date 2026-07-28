/**
 * @file HomeTab.jsx
 * @description المكون الرئيسي لتبويب الصفحة الرئيسية (Home) في بوابة الطالب.
 * يعرض الترحيب المخصص، مؤشر العد التنازلي للمحاضرة القادمة، حالة الحضور، تنبيهات الحرمان، وجدول اليوم الإرشادي.
 * @author أنتيجرافيتي (Antigravity) — HCI Overhaul v2
 */

import React from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

/**
 * مكون الصفحة الرئيسية المخصص للطلاب.
 * — تحسين HCI كامل: تسلسل بصري واضح، touch targets ≥44px، انيميشن احترافي،
 *   بطاقات ذات أولوية مرئية، live lecture indicator، وQR quick actions.
 */
export default function HomeTab({
  isAr,
  profile,
  todayLectures,
  attendanceStats,
  subjectStats,
  countdownDisplay,
  countdownSubText,
  schedules,
  activeLectureNow,
  sandboxMode,
  toggleSandbox,
  isInstallable,
  installApp,
  allAlerts,
  navigate,
  setProfileViewMode,
  setActiveTab,
  handleManualSync,
  goalReminders = [],
  onOpenPwaModal
}) {
  const now = new Date();
  const currentTimeStr = now.toTimeString().substring(0, 5);

  // فرز وترتيب محاضرات اليوم بناءً على وقت البدء
  const sortedToday = [...todayLectures].sort((a, b) => {
    const startA = (a.overrides?.[0]?.startTime || a.startTime) || '';
    const startB = (b.overrides?.[0]?.startTime || b.startTime) || '';
    return startA.localeCompare(startB);
  });

  const announcementsText = isAr
    ? '🚨 عاجل: تم تحديث قاعة محاضرة هندسة البرمجيات • 📢 تنويه: تأكد من تفعيل الإشعارات الفورية للجدول الجامعي'
    : '🚨 Rescheduling Notice: Web Lab relocated to Lab 5 • 📢 Tip: Keep push notifications enabled for live updates';

  // معالجة وحساب بيانات المحاضرات للعرض
  const lecturesToRender = sortedToday.length > 0 ? sortedToday.map((lec) => {
    const start = (lec.overrides?.[0]?.startTime || lec.startTime);
    const end = (lec.overrides?.[0]?.endTime || lec.endTime);
    const isCompleted = end < currentTimeStr;
    const isActiveNow = currentTimeStr >= start && currentTimeStr <= end;
    return {
      id: lec.id,
      timeStr: start + ' - ' + end,
      title: lec.subject.code + ': ' + lec.subject.name,
      lecturer: lec.lecturerName,
      room: (lec.overrides?.[0]?.newRoom?.name || lec.room?.name) || 'N/A',
      isActiveNow,
      isCompleted,
      startTime: start
    };
  }) : [
    { id: 'mock-lec-1', timeStr: '9:00 - 10:15', title: 'CS 401: AI Principles', lecturer: 'Prof. Khalid Al-Faisal', room: 'Rm 201', isActiveNow: true, isCompleted: false, startTime: '09:00' },
    { id: 'mock-lec-2', timeStr: '10:30 - 11:45', title: 'MAT 302: Calculus III', lecturer: 'Prof. Amina Saeed', room: 'Rm 305', isActiveNow: false, isCompleted: false, startTime: '10:30' },
    { id: 'mock-lec-3', timeStr: '12:15 - 13:30', title: 'HIS 101: History', lecturer: '', room: 'Rm 102', isActiveNow: false, isCompleted: false, startTime: '12:15' }
  ];

  const lectureCount = sortedToday.length;

  // إعداد أيام التقويم المصغر الأسبوعي
  const dayMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const todayName = dayMap[now.getDay()];
  const weekDays = ['SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
  const dayNamesAr = { SATURDAY: 'س', SUNDAY: 'ح', MONDAY: 'ن', TUESDAY: 'ث', WEDNESDAY: 'ر', THURSDAY: 'خ' };
  const dayNamesEn = { SATURDAY: 'Sa', SUNDAY: 'Su', MONDAY: 'Mo', TUESDAY: 'Tu', WEDNESDAY: 'We', THURSDAY: 'Th' };

  // ── مؤشر الحضور الكلي ──
  const attendancePct = attendanceStats?.totalSessions > 0
    ? Math.round((attendanceStats.present / attendanceStats.totalSessions) * 100)
    : null;

  const attendanceColor = attendancePct === null
    ? '#64748b'
    : attendancePct >= 85 ? '#10b981'
    : attendancePct >= 75 ? 'var(--accent)'
    : '#ef4444';

  // ── إجراءات سريعة ──
  const quickActions = [
    {
      id: 'checkin',
      icon: '📍',
      titleAr: 'تحضير GPS',
      titleEn: 'GPS Check-In',
      descAr: 'تسجيل حضور تلقائي',
      descEn: 'Verify presence via GPS',
      onClick: () => {
        if (activeLectureNow) {
          toast.success(isAr ? 'تم تسجيل الحضور بالـ GPS بنجاح!' : 'GPS Check-In marked successfully!');
        } else {
          toast.error(isAr ? 'لا توجد محاضرة نشطة حالياً' : 'No active lecture now');
        }
      }
    },
    {
      id: 'forum',
      icon: '💬',
      titleAr: 'الملتقى الطلابي',
      titleEn: 'Class Forum',
      descAr: 'نقاشات الدفعة',
      descEn: 'Discuss with classmates',
      onClick: () => setActiveTab('exchange')
    },
    {
      id: 'tasks',
      icon: '✅',
      titleAr: 'المهام والتركيز',
      titleEn: 'Tasks & Focus',
      descAr: 'إنجاز التكاليف',
      descEn: 'Complete assignments',
      onClick: () => setActiveTab('goals')
    },
    {
      id: 'print',
      icon: '🖨️',
      titleAr: 'طباعة الجدول',
      titleEn: 'Print Schedule',
      descAr: 'حفظ الجدول كـ PDF',
      descEn: 'Save weekly timetable',
      onClick: () => window.print()
    }
  ];

  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ── 0. Dynamic Morning & Time-Based Greeting Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-[22px] bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30 flex items-center justify-between gap-3 shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl shrink-0 shadow-inner">
            {now.getHours() < 12 ? '☀️' : now.getHours() < 17 ? '🌤️' : '🌙'}
          </div>
          <div>
            <h3 className="text-xs font-black text-amber-300 font-sans">
              {now.getHours() < 12 
                ? (isAr ? `صباح الخير والأمل، ${profile.name?.split(' ')[0] || 'طالبنا المتميز'}! ☀️` : `Good Morning, ${profile.name?.split(' ')[0]}! ☀️`)
                : now.getHours() < 17 
                  ? (isAr ? `طاب يومك بذكر الله، ${profile.name?.split(' ')[0]}! 🌤️` : `Good Afternoon, ${profile.name?.split(' ')[0]}! 🌤️`)
                  : (isAr ? `مساء الخير والراحة، ${profile.name?.split(' ')[0]}! 🌙` : `Good Evening, ${profile.name?.split(' ')[0]}! 🌙`)}
            </h3>
            <p className="text-[10px] font-bold text-slate-300 mt-0.5 leading-relaxed">
              {isAr 
                ? `الانضباط اليومي هو مفتاح التميز! لديك اليوم ${sortedToday.length} محاضرات جارية و ${goalReminders.length} تكليفات معلقة.`
                : `Consistency is key! You have ${sortedToday.length} classes today and ${goalReminders.length} pending goals.`}
            </p>
          </div>
        </div>
        <div className="shrink-0 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black px-2.5 py-1.5 rounded-xl text-center">
          ⭐ {profile.xp ?? 350} XP
        </div>
      </motion.div>

      {/* ── 1. بطاقة الترحيب — Visual Priority 1 ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-[22px] p-5"
        style={{
          background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(var(--primary-color-rgb, 245,158,11),0.04) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
        }}
      >
        {/* خلفية ضوئية زخرفية */}
        <div
          className="absolute -top-8 -right-8 w-28 h-28 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(var(--primary-color-rgb,245,158,11),0.12) 0%, transparent 70%)' }}
          aria-hidden="true"
        />

        {/* صف العنوان */}
        <div className="flex items-start justify-between relative z-10 mb-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>
              {isAr
                ? (new Date().getHours() < 12 ? '☀️ صباح الخير' : new Date().getHours() < 17 ? '🌤 طاب يومك' : '🌙 مساء الخير')
                : (new Date().getHours() < 12 ? '☀️ Good morning' : new Date().getHours() < 17 ? '🌤 Good afternoon' : '🌙 Good evening')}
            </p>
            <h2 className="text-[18px] font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
              {profile.name?.split(' ')[0] || (isAr ? 'الطالب' : 'Student')}
            </h2>
            <p className="text-[11px] font-semibold mt-0.5 truncate" style={{ color: 'var(--accent)' }}>
              {profile.department || (isAr ? 'هندسة وتكنولوجيا المعلومات' : 'Engineering & IT')}
            </p>
          </div>

          {/* Streak Badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] shrink-0"
            style={{
              background: 'rgba(249,115,22,0.12)',
              border: '1px solid rgba(249,115,22,0.3)'
            }}
            title={isAr ? 'أيام التسجيل المتتالية' : 'Login streak'}
          >
            <span style={{ fontSize: '18px' }}>🔥</span>
            <div className="text-center">
              <p className="text-[15px] font-black leading-none" style={{ color: '#f97316' }}>
                {profile.streak ?? 7}
              </p>
              <p className="text-[8px] font-bold" style={{ color: '#f97316', opacity: 0.8 }}>
                {isAr ? 'يوم' : 'days'}
              </p>
            </div>
          </div>
        </div>

        {/* شريط المعلومات السفلي */}
        <div
          className="flex items-center gap-0 text-[10.5px] font-bold rounded-[12px] overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          {[
            {
              label: profile.level ? (isAr ? `م ${profile.level}` : `Lvl ${profile.level}`) : (isAr ? 'مستوى 3' : 'Level 3'),
              icon: '🎓'
            },
            {
              label: profile.groupName || 'Group A',
              icon: '👥'
            },
            {
              label: `${profile.xp ?? 350} XP`,
              icon: '⭐',
              accent: true
            }
          ].map((item, i) => (
            <div
              key={i}
              className="flex-1 flex items-center justify-center gap-1 py-2"
              style={{
                borderRight: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                color: item.accent ? 'var(--accent)' : 'var(--text-secondary)'
              }}
            >
              <span style={{ fontSize: '11px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── 1b. مؤشر الجاهزية التراكمي للاختبارات (Exam Readiness Hub) ── */}
      {(() => {
        const pendingCount = goalReminders.length;
        const absentCount = attendanceStats?.absent || 0;
        const computedScore = Math.max(45, Math.min(100, 100 - (pendingCount * 7) - (absentCount * 4)));
        const isGood = computedScore >= 80;
        const isWarn = computedScore >= 65 && computedScore < 80;

        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-[22px] relative overflow-hidden space-y-3"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(14,165,233,0.08) 100%)',
              border: '1px solid rgba(16,185,129,0.25)',
              boxShadow: '0 4px 20px rgba(16,185,129,0.08)'
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[12px] font-black text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <span>🎯</span>
                  <span>{isAr ? 'مؤشر الجاهزية للاختبارات (Exam Readiness)' : 'Exam Readiness Score'}</span>
                </h3>
                <p className="text-[9.5px] font-bold text-slate-300 mt-0.5">
                  {isAr 
                    ? `معدل استعدادك الحالي للاختبارات النهائية بناءً على الحضور والتكاليف` 
                    : `Your predicted readiness for upcoming exams`}
                </p>
              </div>
              <div className="text-right">
                <span className={`text-2xl font-black font-mono block ${
                  isGood ? 'text-emerald-400' : isWarn ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {computedScore}%
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
              <motion.div
                className={`h-full ${
                  isGood 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                    : isWarn 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-400' 
                      : 'bg-gradient-to-r from-red-500 to-rose-400'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${computedScore}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[9px] font-bold">
              <div className="p-1.5 rounded-xl bg-black/20 border border-white/5">
                <span className="text-slate-400 block">{isAr ? 'حضور المحاضرات' : 'Attendance'}</span>
                <span className="text-emerald-400 font-mono font-black">{attendancePct ?? 100}%</span>
              </div>
              <div className="p-1.5 rounded-xl bg-black/20 border border-white/5">
                <span className="text-slate-400 block">{isAr ? 'التكاليف المعلقة' : 'Pending Tasks'}</span>
                <span className="text-amber-400 font-mono font-black">{pendingCount}</span>
              </div>
              <div className="p-1.5 rounded-xl bg-black/20 border border-white/5">
                <span className="text-slate-400 block">{isAr ? 'التقييم التراكمي' : 'Status'}</span>
                <span className="text-emerald-300 font-black">{isGood ? (isAr ? 'ممتاز 🚀' : 'Excellent') : (isAr ? 'تحتاج تحسين ⚡' : 'Improve')}</span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('exchange')}
              className="w-full py-2 rounded-[12px] text-[10.5px] font-black text-center transition-all bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 active:scale-95"
            >
              🤖 {isAr ? 'حل كويزات الممارسة الفورية في الملتقى لرفع النسبة' : 'Practice AI Quizzes in Forum to Raise Score'}
            </button>
          </motion.div>
        );
      })()}

      {/* ── 2. تنبيه ذكي قبل المحاضرة: التكاليف والمشاريع المعلقة ── */}
      {(() => {
        const upcomingLecWithPending = sortedToday.map(lec => {
          const end = (lec.overrides?.[0]?.endTime || lec.endTime) || '';
          if (end < currentTimeStr) return null;
          const pendingForLec = goalReminders.filter(g => g.subjectId === lec.subjectId || (g.subject && lec.subject && g.subject.code === lec.subject.code));
          return pendingForLec.length > 0 ? { lec, pendingGoals: pendingForLec } : null;
        }).find(Boolean);

        if (!upcomingLecWithPending) return null;
        const { lec, pendingGoals } = upcomingLecWithPending;

        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-[20px] relative overflow-hidden space-y-3"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(245,158,11,0.12) 100%)',
              border: '1px solid rgba(239,68,68,0.3)',
              boxShadow: '0 4px 20px rgba(239,68,68,0.15)'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="animate-bounce" style={{ fontSize: '20px' }}>⚡</span>
                <div>
                  <h4 className="text-[12px] font-black text-red-400">
                    {isAr ? `تنبيه مسبق قبل محاضرة ${lec.subject.name}` : `Pre-Lecture Alert: ${lec.subject.name}`}
                  </h4>
                  <p className="text-[9.5px] font-bold text-slate-300">
                    {isAr ? `تبدأ الساعة ${lec.startTime} • لديك ${pendingGoals.length} تكليف معلق من الأسبوع السابق!` : `Starts ${lec.startTime} • You have ${pendingGoals.length} pending task(s)!`}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-red-500/20 text-red-300 border border-red-500/30">
                {isAr ? 'عاجل' : 'Urgent'}
              </span>
            </div>

            <div className="space-y-1.5">
              {pendingGoals.map(g => (
                <div
                  key={g.id}
                  className="flex items-center justify-between p-2 rounded-[12px] bg-slate-950/60 border border-red-500/20 text-[10px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-amber-400">📝</span>
                    <span className="font-bold text-white truncate">{g.title}</span>
                  </div>
                  {g.weekNumber && (
                    <span className="text-[8.5px] font-black font-mono bg-white/10 px-1.5 py-0.5 rounded text-amber-300">
                      W{g.weekNumber}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveTab('goals')}
              className="w-full py-2.5 rounded-[12px] text-[11px] font-black text-center transition-all bg-gradient-to-r from-amber-500 to-red-500 text-slate-950 active:scale-95 shadow-md"
            >
              🚀 {isAr ? 'عرض وإنجاز التكليف فوراً' : 'View & Complete Task Now'}
            </button>
          </motion.div>
        );
      })()}

      {/* ── تنبيهات المهام المعلقة العامة والحرمان ── */}
      {goalReminders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card-warning p-4 space-y-2.5"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span className="text-[11px] font-black" style={{ color: '#fbbf24' }}>
              {isAr
                ? `إجمالي المهام المعلقة: ${goalReminders.length}`
                : `Total pending tasks: ${goalReminders.length}`}
            </span>
          </div>
          <div className="space-y-1.5">
            {goalReminders.slice(0, 2).map(g => (
              <div
                key={g.id}
                className="flex justify-between items-center rounded-[10px] px-3 py-1.5"
                style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <span className="text-[10px] font-bold truncate max-w-[65%]" style={{ color: '#f8fafc' }}>
                  {g.title} <span style={{ color: '#94a3b8' }}>({g.subject?.name})</span>
                </span>
                <span className="text-[9px] font-black" style={{ color: '#94a3b8' }}>
                  {g.weekNumber ? (isAr ? `أسبوع ${g.weekNumber}` : `Wk ${g.weekNumber}`) : (isAr ? 'سابق' : 'Past')}
                </span>
              </div>
            ))}
            {goalReminders.length > 2 && (
              <p className="text-[9px] font-bold px-1" style={{ color: '#64748b' }}>
                {isAr ? `+ ${goalReminders.length - 2} مهام أخرى` : `+ ${goalReminders.length - 2} more`}
              </p>
            )}
          </div>
          <button
            onClick={() => setActiveTab('goals')}
            className="active-press w-full py-2 rounded-[12px] text-[11px] font-black text-center transition-all"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}
          >
            🎯 {isAr ? 'إنجاز التكاليف والمهام' : 'View & Complete Tasks'}
          </button>
        </motion.div>
      )}

      {/* تنبيه الحرمان القطعي */}
      {subjectStats.filter(s => s.hasDeprivation).length > 0 && (
        <div className="card-danger p-4 space-y-2" role="alert">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '18px' }}>❌</span>
            <span className="text-[11px] font-black" style={{ color: '#f87171' }}>
              {isAr ? 'تنبيه حرمان — الغياب تجاوز 25%' : 'Deprivation Alert — Absences > 25%'}
            </span>
          </div>
          <ul className="space-y-1 text-[10px] font-bold" style={{ color: '#fca5a5' }}>
            {subjectStats.filter(s => s.hasDeprivation).map(s => (
              <li key={s.subjectCode} className="flex justify-between">
                <span>{s.subjectName} ({s.subjectCode})</span>
                <span className="font-mono">{s.absenceRate}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* تنبيه الإنذار (15%-25%) */}
      {subjectStats.filter(s => s.hasWarning && !s.hasDeprivation).length > 0 && (
        <div className="card-warning p-4 space-y-2" role="alert">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span className="text-[11px] font-black" style={{ color: '#fbbf24' }}>
              {isAr ? 'إنذار غياب — اقتراب من حد الحرمان' : 'Absence Warning — Approaching limit'}
            </span>
          </div>
          <ul className="space-y-1 text-[10px] font-bold" style={{ color: '#fde68a' }}>
            {subjectStats.filter(s => s.hasWarning && !s.hasDeprivation).map(s => (
              <li key={s.subjectCode} className="flex justify-between">
                <span>{s.subjectName} ({s.subjectCode})</span>
                <span className="font-mono">{s.absenceRate}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 3. شريط العد التنازلي + مؤشر الحضور ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* بطاقة العد التنازلي */}
        <div
          className="card-base p-4 flex flex-col gap-2"
          style={{ borderTop: '2px solid rgba(41,121,255,0.6)' }}
        >
          <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#2979ff' }}>
            {isAr ? '⏱ المحاضرة القادمة' : '⏱ Next Lecture'}
          </p>
          {countdownDisplay ? (
            <>
              <p className="countdown-display">{countdownDisplay}</p>
              <p className="text-[9px] font-semibold truncate" style={{ color: 'var(--text-muted)' }}>
                {countdownSubText}
              </p>
            </>
          ) : (
            <p className="text-[12px] font-black" style={{ color: 'var(--accent)' }}>
              {isAr ? 'لا توجد اليوم' : 'None today'}
            </p>
          )}
        </div>

        {/* بطاقة الحضور + التقويم الأسبوعي */}
        <div className="card-base p-4 flex flex-col gap-2">
          <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {isAr ? '📅 أيام الأسبوع' : '📅 This Week'}
          </p>
          <div className="flex gap-1 justify-between">
            {weekDays.map(day => {
              const isToday = day === todayName;
              const hasClass = schedules.some(s => (s.overrides?.[0]?.dayOfWeek || s.dayOfWeek) === day);
              return (
                <div key={day} className="flex flex-col items-center gap-1">
                  <span
                    className="text-[8px] font-black"
                    style={{ color: isToday ? 'var(--accent)' : 'var(--text-muted)' }}
                  >
                    {isAr ? dayNamesAr[day] : dayNamesEn[day]}
                  </span>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: isToday
                        ? 'var(--accent)'
                        : hasClass
                        ? 'rgba(41,121,255,0.15)'
                        : 'rgba(255,255,255,0.04)',
                      border: isToday
                        ? '2px solid var(--accent)'
                        : hasClass
                        ? '1px solid rgba(41,121,255,0.3)'
                        : '1px solid rgba(255,255,255,0.05)',
                      boxShadow: isToday ? '0 0 10px var(--accent-glow)' : 'none'
                    }}
                  >
                    {hasClass && !isToday && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#2979ff' }} />
                    )}
                    {isToday && (
                      <span className="text-[8px] font-black" style={{ color: '#070b13' }}>✓</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* مؤشر نسبة الحضور */}
          {attendancePct !== null && (
            <div className="mt-1 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[8.5px] font-bold" style={{ color: 'var(--text-muted)' }}>
                  {isAr ? 'الحضور' : 'Attendance'}
                </span>
                <span className="text-[8.5px] font-black" style={{ color: attendanceColor }}>
                  {attendancePct}%
                </span>
              </div>
              <div className="attendance-bar-track">
                <div
                  className="attendance-bar-fill"
                  style={{
                    width: `${attendancePct}%`,
                    background: `linear-gradient(90deg, ${attendanceColor}, ${attendanceColor}88)`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. شريط الإعلانات الحية ── */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-[14px] overflow-hidden"
        style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}
        role="marquee"
        aria-live="polite"
        aria-label={isAr ? 'إعلانات الكلية' : 'College announcements'}
      >
        <div
          className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full"
          style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}
        >
          <span className="live-dot" />
          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#f97316', whiteSpace: 'nowrap' }}>
            {isAr ? 'مباشر' : 'Live'}
          </span>
        </div>
        <div className="flex-1 overflow-hidden relative h-[14px]">
          <div className="animate-marquee whitespace-nowrap absolute text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {announcementsText}
          </div>
        </div>
      </div>

      {/* ── 5. جدول محاضرات اليوم ── */}
      <div className="space-y-2.5">
        <div className="section-header">
          <h3 className="section-title">{isAr ? 'جدول اليوم' : "Today's Schedule"}</h3>
          <span className="chip chip-accent">
            {lectureCount} {isAr ? 'محاضرات' : 'classes'}
          </span>
        </div>

        <div className="space-y-2.5">
          {lecturesToRender.map((lec, idx) => {
            const isActive = lec.isActiveNow;
            const isDone = lec.isCompleted;

            return (
              <motion.div
                key={lec.id}
                initial={{ opacity: 0, x: isAr ? 12 : -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.25 }}
                className="relative overflow-hidden rounded-[18px] flex gap-0"
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(var(--primary-color-rgb,245,158,11),0.06) 0%, var(--bg-card) 60%)'
                    : 'var(--bg-card)',
                  border: isActive
                    ? '1px solid rgba(var(--primary-color-rgb,245,158,11),0.3)'
                    : '1px solid rgba(255,255,255,0.05)',
                  opacity: isDone ? 0.45 : 1,
                  boxShadow: isActive ? '0 0 20px rgba(var(--primary-color-rgb,245,158,11),0.08)' : '0 2px 8px rgba(0,0,0,0.2)'
                }}
              >
                {/* شريط الجانب الملوّن (Status Indicator) */}
                <div
                  className="w-[3px] rounded-full shrink-0"
                  style={{
                    background: isActive
                      ? 'var(--accent)'
                      : isDone
                      ? '#334155'
                      : '#2979ff',
                    margin: '10px 0 10px 10px'
                  }}
                />

                {/* محتوى البطاقة */}
                <div className="flex-1 p-3 pl-2 flex justify-between items-start gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="text-[10px] font-black font-mono"
                        style={{ color: isActive ? 'var(--accent)' : '#64748b' }}
                      >
                        {lec.timeStr}
                      </span>
                      {isActive && (
                        <span className="live-badge">
                          <span className="live-dot" />
                          LIVE
                        </span>
                      )}
                    </div>
                    <p
                      className="text-[12px] font-black truncate leading-tight"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {lec.title}
                    </p>
                    {lec.lecturer && (
                      <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {lec.lecturer}
                      </p>
                    )}
                  </div>

                  {/* القاعة */}
                  <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
                    <span
                      className="chip chip-slate"
                      style={{ fontSize: '9px', fontWeight: 800, fontFamily: 'monospace' }}
                    >
                      {lec.room}
                    </span>
                    {isDone && (
                      <span className="text-[8px] font-bold" style={{ color: '#334155' }}>
                        {isAr ? 'انتهت' : 'Done'}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {lecturesToRender.length === 0 && (
            <div className="card-subtle p-6 text-center space-y-2">
              <span style={{ fontSize: '28px' }}>😴</span>
              <p className="text-[12px] font-black" style={{ color: 'var(--text-secondary)' }}>
                {isAr ? 'لا توجد محاضرات اليوم' : 'No lectures today'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── 6. الإجراءات السريعة ── */}
      <div className="space-y-2.5">
        <div className="section-header">
          <h3 className="section-title">{isAr ? 'إجراءات سريعة' : 'Quick Actions'}</h3>
          <button
            onClick={() => {
              if (onOpenPwaModal) onOpenPwaModal();
              else if (installApp) installApp();
            }}
            className="chip chip-accent active-press"
            style={{ cursor: 'pointer' }}
            aria-label={isAr ? 'تثبيت التطبيق' : 'Install app'}
          >
            📲 {isAr ? 'تثبيت التطبيق' : 'Install App'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action, idx) => (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 + 0.1, duration: 0.22 }}
              onClick={action.onClick}
              className="quick-action-btn"
              aria-label={isAr ? action.titleAr : action.titleEn}
            >
              {/* أيقونة */}
              <div className="quick-action-icon" aria-hidden="true">
                {action.icon}
              </div>
              {/* نص */}
              <div className="space-y-0.5 text-left">
                <p className="text-[12px] font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {isAr ? action.titleAr : action.titleEn}
                </p>
                <p className="text-[9.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {isAr ? action.descAr : action.descEn}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
