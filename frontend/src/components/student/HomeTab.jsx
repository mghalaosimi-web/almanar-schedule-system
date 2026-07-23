/**
 * @file HomeTab.jsx
 * @description المكون الرئيسي لتبويب الصفحة الرئيسية (Home) في بوابة الطالب.
 * يعرض الترحيب المخصص، مؤشر العد التنازلي للمحاضرة القادمة، حالة الحضور، تنبيهات الحرمان، وجدول اليوم الإرشادي.
 * @author أنتيجرافيتي (Antigravity)
 */

import React from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

/**
 * مكون الصفحة الرئيسية المخصص للطلاب.
 * 
 * الميزات:
 * 1. لوحة ترحيب تفاعلية تعرض الاسم والتخصص والمستوى الأكاديمي.
 * 2. تنبيهات الأمان والتوثيق في حال كان الحساب معلقاً أو بانتظار موافقة الإدارة.
 * 3. لوحة تحذيرات الغياب والحرمان التلقائية (تنبيهات تجاوز الغياب لنسب 15% و 25%).
 * 4. شريط عد تنازلي ديناميكي يعرض الوقت المتبقي لأقرب محاضرة قادمة.
 * 5. تقويم مصغر أسبوعي تفاعلي يوضح أيام الدراسة والحضور.
 * 6. شريط إعلانات متحرك (Marquee) لعرض التعميمات العاجلة من الإدارة.
 * 7. عرض جدول محاضرات اليوم مصنفاً حسب الحالة (نشطة حالياً، مكتملة، قادمة) مع مؤشرات البث المباشر.
 * 8. شبكة الإجراءات السريعة (التحضير الجغرافي، الإعلانات، المقررات، جدول الامتحانات).
 * 
 * @param {Object} props - خصائص المكون.
 * @param {boolean} props.isAr - لغة المكون (عربي/إنجليزي).
 * @param {Object} props.profile - كائن ملف الطالب المحتوي على بياناته الأكاديمية والتوثيقية.
 * @param {Array<Object>} props.todayLectures - قائمة محاضرات اليوم الفعلي.
 * @param {Object} props.attendanceStats - إحصائيات الغياب والحضور العامة للطالب.
 * @param {Array<Object>} props.subjectStats - إحصائيات تفصيلية لكل مادة دراسية لتحديد الإنذارات والحرمان.
 * @param {string} props.countdownDisplay - نص العد التنازلي المنسق للمحاضرة التالية.
 * @param {string} props.countdownSubText - النص الفرعي المصاحب للعد التنازلي.
 * @param {Array<Object>} props.schedules - إجمالي الجدول الدراسي للطالب لتحديد أيام الدراسة.
 * @param {Object|null} props.activeLectureNow - كائن المحاضرة النشطة حالياً إن وجدت لتسجيل الحضور الفوري.
 * @param {boolean} props.sandboxMode - حالة وضع المحاكاة والاختبار المحلي للجدول.
 * @param {Function} props.toggleSandbox - دالة تبديل وضع محاكي التعديل.
 * @param {boolean} props.isInstallable - ما إذا كان التطبيق قابلاً للتثبيت كـ PWA على جهاز الطالب.
 * @param {Function} props.installApp - دالة بدء تثبيت تطبيق الـ PWA.
 * @param {Array<Object>} props.allAlerts - قائمة جميع الإشعارات الموجهة لتحديد عددها.
 * @param {Function} props.navigate - دالة التنقل والتوجيه بين المسارات.
 * @param {Function} props.setProfileViewMode - دالة التحكم في الشاشات الفرعية للملف الشخصي.
 * @param {Function} props.setActiveTab - دالة التنقل بين التبويب الرئيسي للوحة التحكم.
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
  goalReminders = []
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

  return (
    <div className="space-y-5">
      {/* ── 1. لوحة الترحيب بالطالب ── */}
      <div className="bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-card)]/70 p-5 rounded-[24px] border border-[var(--border-color)] shadow-glass relative overflow-hidden mb-5">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--accent-dim)] rounded-full blur-2xl"></div>
        <div className="flex items-center justify-between relative z-10 mb-3">
          <div>
            <h3 className="text-lg font-bold text-white mb-0.5">{profile.name || (isAr ? 'طالب منار' : 'Manar Student')}</h3>
            <p className="text-[var(--accent)] text-xs font-medium">{profile.department || (isAr ? 'هندسة وتكنولوجيا المعلومات' : 'Engineering & IT')}</p>
          </div>
          {/* Daily Streak Badge */}
          <div className="bg-orange-500/20 border border-orange-500/50 px-2 py-1 rounded-xl flex items-center gap-1 shadow-glow cursor-pointer hover:bg-orange-500/30 transition">
            <span className="text-orange-400 font-bold text-sm">{profile.streak ?? 7}</span>
            <span className="text-lg">🔥</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#94a3b8] relative z-10 bg-[var(--bg-primary)]/50 p-2 rounded-xl">
          <span>{profile.level ? ((isAr ? 'مستوى ' : 'Level ') + profile.level) : (isAr ? 'مستوى 3' : 'Level 3')}</span>
          <div className="w-1 h-1 bg-slate-650 rounded-full"></div>
          <span>{profile.groupName || 'Group A'}</span>
          <div className="w-1 h-1 bg-slate-650 rounded-full"></div>
          <span className="font-mono text-[var(--accent)]/80">{profile.xp ?? 350} XP 🏆</span>
        </div>
      </div>

      {/* ── 2. تنبيه عدم توثيق الحساب الدراسي ── */}
      {false && (!profile.isEmailVerified || !profile.isPhoneVerified) && (
        <div
          className="p-4 rounded-2xl border border-amber-500/30 bg-amber-550/10 text-amber-200 text-xs font-bold shadow-lg space-y-2"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span className="font-black text-amber-400 uppercase tracking-wide">
              {isAr ? 'الحساب قيد المراجعة والتوثيق' : 'Account Under Verification'}
            </span>
          </div>
          <p className="text-[10px] text-slate-350 leading-relaxed font-bold">
            {isAr
              ? 'حسابك غير مفعل بالكامل بعد من قبل إدارة الكلية. يرجى تعديل الإعدادات ورفع صورة بطاقتك الجامعية لتسجيل طلب التوثيق والقبول.'
              : 'Your profile has not been fully verified by administration. Please go to settings and upload your student ID photo to submit for verification.'}
          </p>
          <div className={isAr ? 'text-left mt-2' : 'text-right mt-2'}>
            <button
              onClick={() => {
                setActiveTab('profile');
                setProfileViewMode('edit');
              }}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black rounded-lg transition-all active:scale-95"
            >
              ⚙️ {isAr ? 'الانتقال لرفع الوثيقة' : 'Go to ID Upload'}
            </button>
          </div>
        </div>
      )}

      {goalReminders.length > 0 && (
        <div
          className="p-4 rounded-2xl border border-amber-500/25 bg-amber-950/10 text-amber-200 text-xs font-bold shadow-lg space-y-2.5"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span className="font-black text-amber-400 uppercase tracking-wide">
              {isAr ? 'لديك مهام معلقة لم تنجزها بعد!' : 'You have pending tasks to complete!'}
            </span>
          </div>
          <p className="text-[10px] text-slate-350 leading-relaxed font-bold">
            {isAr
              ? `لديك عدد (${goalReminders.length}) تكاليف معلقة من المحاضرات السابقة أو الأسابيع الماضية. يرجى إنجازها في أقرب وقت:`
              : `You have (${goalReminders.length}) pending tasks from previous lectures or weeks. Please complete them as soon as possible:`}
          </p>
          <div className="space-y-1.5 pt-1">
            {goalReminders.slice(0, 3).map(g => (
              <div key={g.id} className="flex justify-between items-center bg-black/10 px-3 py-1.5 rounded-lg text-[9.5px] border border-white/5">
                <span className="text-white truncate max-w-[70%]">{g.title} ({g.subject?.name})</span>
                <span className="text-slate-400 text-[8.5px] font-mono font-bold">
                  {g.weekNumber ? (isAr ? `الأسبوع ${g.weekNumber}` : `Week ${g.weekNumber}`) : (isAr ? 'محاضرة سابقة' : 'Past Lecture')}
                </span>
              </div>
            ))}
            {goalReminders.length > 3 && (
              <p className="text-[9px] text-slate-500 font-bold px-1">
                {isAr ? `+ وعدد ${goalReminders.length - 3} مهام أخرى معلقة` : `+ and ${goalReminders.length - 3} more pending tasks`}
              </p>
            )}
          </div>
          <div className={isAr ? 'text-left mt-2.5' : 'text-right mt-2.5'}>
            <button
              onClick={() => setActiveTab('goals')}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-450 text-slate-950 text-[10px] font-black rounded-lg transition-all active:scale-95"
            >
              🎯 {isAr ? 'عرض وإنجاز التكاليف والمهام' : 'View & Complete Tasks'}
            </button>
          </div>
        </div>
      )}

      {/* ── 3. تنبيهات وإنذارات الحرمان بسبب الغياب ── */}
      {/* إنذارات الحرمان القطعي (الغياب > 25%) */}
      {subjectStats.filter(s => s.hasDeprivation).length > 0 && (
        <div className="p-4 rounded-2xl border border-red-500/30 bg-red-950/20 text-red-200 text-xs font-bold shadow-lg space-y-2 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-lg">❌</span>
            <span className="font-black text-red-400 uppercase tracking-wide">
              {isAr ? 'تنبيه حرمان (تجاوز الغياب 25%)' : 'Deprivation Alert (Absences > 25%)'}
            </span>
          </div>
          <p className="text-[10px] text-slate-300 leading-relaxed font-bold">
            {isAr
              ? 'لقد تجاوزت نسبة الغياب المسموح بها في المقررات التالية وقد تتعرض للحرمان من دخول الامتحان:'
              : 'You have exceeded the maximum allowed absence rate in the following courses and may be deprived from examinations:'}
          </p>
          <ul className="list-disc list-inside space-y-1 text-[10.5px] font-mono text-red-300">
            {subjectStats.filter(s => s.hasDeprivation).map(s => (
              <li key={s.subjectCode}>
                {s.subjectName} ({s.subjectCode}) - {isAr ? 'نسبة الغياب:' : 'Absence rate:'} {s.absenceRate}%
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* إنذارات الاقتراب والتحذير (الغياب بين 15% و 25%) */}
      {subjectStats.filter(s => s.hasWarning && !s.hasDeprivation).length > 0 && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs font-bold shadow-lg space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span className="font-black text-amber-400 uppercase tracking-wide">
              {isAr ? 'إنذار غياب (تجاوز الغياب 15%)' : 'Absence Warning (Absences > 15%)'}
            </span>
          </div>
          <p className="text-[10px] text-slate-300 leading-relaxed font-bold">
            {isAr
              ? 'يرجى الحذر، لقد اقتربت نسبة الغياب من حد الحرمان في المقررات التالية:'
              : 'Please be cautious, your absence rate is approaching the deprivation limit in the following courses:'}
          </p>
          <ul className="list-disc list-inside space-y-1 text-[10.5px] font-mono text-amber-300">
            {subjectStats.filter(s => s.hasWarning && !s.hasDeprivation).map(s => (
              <li key={s.subjectCode}>
                {s.subjectName} ({s.subjectCode}) - {isAr ? 'نسبة الغياب:' : 'Absence rate:'} {s.absenceRate}%
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 4. مؤشرات العد التنازلي والتقويم المصغر الأسبوعي ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* بطاقة العد التنازلي لأقرب محاضرة */}
        <div className="relative overflow-hidden rounded-[20px] frosted-panel border-[#2979ff]/20 p-4 shadow-lg">
          <div className="absolute top-0 left-0 w-full h-full bg-[#2979ff]/3 pointer-events-none" />
          <p className="text-[8px] font-black uppercase tracking-wider text-[#2979ff] mb-1">
            {isAr ? '⏱ المحاضرة القادمة' : '⏱ Next Lecture'}
          </p>
          {countdownDisplay ? (
            <>
              <p className="text-xl font-black text-white leading-none">{countdownDisplay}</p>
              <p className="text-[8px] text-slate-400 font-bold mt-1 truncate">{countdownSubText}</p>
            </>
          ) : (
            <p className="text-sm font-black text-[var(--accent)]">{isAr ? 'لا توجد محاضرات اليوم' : 'No more today'}</p>
          )}
        </div>

        {/* التقويم المصغر الأسبوعي */}
        <div className="relative overflow-hidden rounded-[20px] frosted-panel p-4 shadow-lg">
          <p className="text-[8px] font-black uppercase tracking-wider text-slate-500 mb-2">
            {isAr ? '📅 أيام الدراسة' : '📅 Week'}
          </p>
          <div className="flex gap-1.5 justify-between">
            {weekDays.map(day => {
              const isToday = day === todayName;
              const hasClass = schedules.some(s => (s.overrides?.[0]?.dayOfWeek || s.dayOfWeek) === day);
              return (
                <div key={day} className="flex flex-col items-center gap-1">
                  <span className={'text-[8px] font-black ' + (isToday ? 'text-[var(--accent)]' : 'text-slate-500')}>
                    {isAr ? dayNamesAr[day] : dayNamesEn[day]}
                  </span>
                  <div className={'w-6 h-6 rounded-full flex items-center justify-center ' +
                    (isToday
                      ? 'bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]'
                      : hasClass
                        ? 'bg-[#2979ff]/20 border border-[#2979ff]/30'
                        : 'bg-white/5 border border-white/5')}>
                    {hasClass && !isToday && <span className="w-1.5 h-1.5 rounded-full bg-[#2979ff]" />}
                    {isToday && <span className="text-[8px] font-black text-slate-950">✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 5. شريط إعلانات وتنبيهات الكلية ── */}
      <div className="frosted-panel border-orange-500/15 rounded-2xl p-3 flex items-center gap-3 backdrop-blur-sm overflow-hidden">
        <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[8px] font-black uppercase tracking-wider whitespace-nowrap">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500" />
          </span>
          {isAr ? 'مباشر' : 'Live'}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden relative h-4">
          <div className="animate-marquee whitespace-nowrap text-[10px] text-slate-300 font-bold absolute">
            {announcementsText}
          </div>
        </div>
      </div>

      {/* ── 6. جدول محاضرات اليوم ── */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h4 className="text-sm font-black text-white tracking-wide">
            {isAr ? 'جدول اليوم' : "Today's Schedule"}
          </h4>
          <span className="text-[9px] font-black text-[var(--accent)] bg-[var(--accent-dim)] border border-[var(--accent-glow)] px-2.5 py-0.5 rounded-full">
            {lectureCount} {isAr ? 'محاضرات' : 'classes'}
          </span>
        </div>
        <div className="space-y-3">
          {lecturesToRender.map((lec) => {
            const isActive = lec.isActiveNow;
            const isCompleted = lec.isCompleted;
            let cardClass = 'relative overflow-hidden rounded-[20px] frosted-panel p-4 border transition-all duration-300';
            let borderGlow = 'border-white/5';
            let leftIndicator = 'bg-[#2979ff]';
            if (isActive) {
              cardClass += ' shadow-[0_0_20px_var(--accent-glow)]';
              borderGlow = 'border-[var(--accent)]/60';
              leftIndicator = 'bg-[var(--accent)]';
            } else if (isCompleted) {
              cardClass += ' opacity-40';
              borderGlow = 'border-white/3';
              leftIndicator = 'bg-slate-700';
            }
            return (
              <div key={lec.id} className={cardClass + ' ' + borderGlow}>
                <div className={'absolute left-0 top-0 bottom-0 w-[4px] rounded-l-[20px] ' + leftIndicator} />
                <div className="pl-3 flex justify-between items-start gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={'text-[11px] font-bold ' + (isActive ? 'text-[var(--accent)]' : 'text-slate-400')}>{lec.timeStr}</span>
                      {!isActive && <span className="text-[11px] font-black text-white truncate">{lec.title}</span>}
                    </div>
                    {isActive && <h4 className="text-sm font-black text-white leading-snug">{lec.title}</h4>}
                    {lec.lecturer && <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{lec.lecturer}</p>}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    {isActive && (
                      <span className="bg-[var(--accent-dim)] border border-[var(--accent-glow)] text-[var(--accent)] text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping" /> LIVE NOW
                      </span>
                    )}
                    <span className="text-[11px] font-bold text-slate-400 font-mono">{lec.room}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 7. أزرار الإجراءات السريعة ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-sm font-black text-[var(--text-primary)] tracking-wide">{isAr ? 'إجراءات سريعة' : 'Quick Actions'}</h4>
          {isInstallable && (
            <button
              onClick={installApp}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-dim)] border border-[var(--accent-glow)] hover:bg-[var(--accent-dim)]/80 rounded-full text-[9px] font-black text-[var(--accent)] transition-all"
            >
              <span>📲</span> {isAr ? 'تثبيت التطبيق' : 'Install App'}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* GPS Check-In */}
          <button
            onClick={() => {
              if (activeLectureNow) {
                toast.success(isAr ? 'تم تسجيل الحضور بالـ GPS بنجاح!' : 'GPS Check-In marked successfully!');
              } else {
                toast.error(isAr ? 'لا توجد محاضرة نشطة حالياً للتحضير' : 'No active lecture now to check in');
              }
            }}
            className="relative overflow-hidden rounded-[20px] p-4 border border-[var(--border-color)] hover:border-[var(--accent)] hover:shadow-[0_0_14px_var(--accent-glow)] bg-[var(--bg-card)] flex flex-col items-start gap-2 shadow-lg text-left active:scale-95 duration-150 transition-all"
          >
            <div className="p-2 bg-[var(--accent-dim)] border border-[var(--accent-glow)] rounded-xl">
              <i className="ph ph-map-pin text-[var(--accent)] text-lg"></i>
            </div>
            <div>
              <span className="text-[11px] font-black text-white block">{isAr ? 'تحضير الـ GPS' : 'GPS Check-In'}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5 font-bold">{isAr ? 'تسجيل الحضور التلقائي بالقاعة' : 'Verify presence via GPS'}</span>
            </div>
          </button>

          {/* Class Hub */}
          <button
            onClick={() => setActiveTab('exchange')}
            className="relative overflow-hidden rounded-[20px] p-4 border border-[var(--border-color)] hover:border-[var(--accent)] hover:shadow-[0_0_14px_var(--accent-glow)] bg-[var(--bg-card)] flex flex-col items-start gap-2 shadow-lg text-left active:scale-95 duration-150 transition-all"
          >
            <div className="p-2 bg-[var(--accent-dim)] border border-[var(--accent-glow)] rounded-xl">
              <i className="ph ph-chats text-[var(--accent)] text-lg"></i>
            </div>
            <div>
              <span className="text-[11px] font-black text-white block">{isAr ? 'الملتقى الطلابي' : 'Class Forum'}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5 font-bold">{isAr ? 'محادثات ونقاشات الدفعة' : 'Discuss with classmates'}</span>
            </div>
          </button>

          {/* Focus Mode & Tasks */}
          <button
            onClick={() => setActiveTab('goals')}
            className="relative overflow-hidden rounded-[20px] p-4 border border-[var(--border-color)] hover:border-[var(--accent)] hover:shadow-[0_0_14px_var(--accent-glow)] bg-[var(--bg-card)] flex flex-col items-start gap-2 shadow-lg text-left active:scale-95 duration-150 transition-all"
          >
            <div className="p-2 bg-[var(--accent-dim)] border border-[var(--accent-glow)] rounded-xl">
              <i className="ph ph-checks text-[var(--accent)] text-lg"></i>
            </div>
            <div>
              <span className="text-[11px] font-black text-white block">{isAr ? 'المهام والتركيز' : 'Tasks & Pomodoro'}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5 font-bold">{isAr ? 'إنجاز التكاليف ومؤقت بومودورو' : 'Complete assignments'}</span>
            </div>
          </button>

          {/* Print Schedule */}
          <button
            onClick={() => {
              window.print();
            }}
            className="relative overflow-hidden rounded-[20px] p-4 border border-[var(--border-color)] hover:border-[var(--accent)] hover:shadow-[0_0_14px_var(--accent-glow)] bg-[var(--bg-card)] flex flex-col items-start gap-2 shadow-lg text-left active:scale-95 duration-150 transition-all"
          >
            <div className="p-2 bg-[var(--accent-dim)] border border-[var(--accent-glow)] rounded-xl">
              <i className="ph ph-printer text-[var(--accent)] text-lg"></i>
            </div>
            <div>
              <span className="text-[11px] font-black text-white block">{isAr ? 'طباعة الجدول' : 'Print Timetable'}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5 font-bold">{isAr ? 'حفظ أو طباعة الجدول الأسبوعي' : 'Print weekly timeline'}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
