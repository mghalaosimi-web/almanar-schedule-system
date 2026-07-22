/**
 * @file ScheduleTab.jsx
 * @description تبويب جدول المحاضرات الدراسي (Schedule View) في بوابة الطالب.
 * يعرض الجدول الدراسي الأسبوعي واليومي للطالب مع إمكانية التصفية حسب الشعب وتنشيط وضع المحاكاة.
 * @author أنتيجرافيتي (Antigravity)
 */

import React, { useState } from 'react';

/**
 * مكون عرض وجدولة المحاضرات للطلاب.
 * 
 * الميزات:
 * 1. تبديل وضع العرض بين اليومي (Daily Timeline) والكامل الأسبوعي (Weekly Timetable).
 * 2. تصفية ذكية للمحاضرات حسب الشعبة لتسهيل استعراض الجداول المشتركة.
 * 3. إدراج فترات استراحة وراحة تلقائية (Break intervals) في الجدول اليومي لتسهيل التنظيم اليومي للطالب.
 * 4. تمييز المحاضرات المعدلة بإنذارات ملونة تعكس طبيعة التعديل (مؤقت/دائم).
 * 5. ربط تفاعلي بوضع المحاكاة للمساعدة في دراسة وحساب التعديلات المحلية الافتراضية.
 * 
 * @param {Object} props - خصائص المكون.
 * @param {boolean} props.isAr - لغة الواجهة (عربي/إنجليزي).
 * @param {Array<Object>} props.schedules - إجمالي المحاضرات الخاصة بالطالب المجلوبة من الخادم.
 * @param {Array<Object>} props.groups - قائمة الشعب الدراسية المتاحة لتسهيل عملية التصفية.
 * @param {boolean} props.sandboxMode - وضع المحاكاة والاختبار الفعلي للجدول.
 * @param {Function} props.setActiveSimulatorSchedule - دالة فتح وتعيين المحاضرة المحددة للمحاكاة.
 * @param {Function} props.setSimulatorDay - دالة تعيين اليوم الافتراضي للمحاكاة.
 * @param {Function} props.setSimulatorStart - دالة تعيين وقت البدء الافتراضي للمحاكاة.
 * @param {Function} props.setSimulatorEnd - دالة تعيين وقت الانتهاء الافتراضي للمحاكاة.
 * @param {Function} props.getActiveDay - دالة استخلاص اليوم الفعلي للمحاضرة (أخذاً بالاعتبار التعديلات المؤقتة).
 * @param {Function} props.getActiveStartTime - دالة استخلاص وقت بدء المحاضرة الفعلي.
 * @param {Function} props.getActiveEndTime - دالة استخلاص وقت انتهاء المحاضرة الفعلي.
 */
export default function ScheduleTab({
  isAr,
  schedules,
  groups,
  sandboxMode,
  setActiveSimulatorSchedule,
  setSimulatorDay,
  setSimulatorStart,
  setSimulatorEnd,
  getActiveDay,
  getActiveStartTime,
  getActiveEndTime,
  goals = []
}) {
  // ── الحالات المحلية لتبويب الجدول ──
  const [scheduleViewMode, setScheduleViewMode] = useState('daily'); // 'daily' | 'weekly'
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'theory' | 'practical'
  
  // تهيئة اليوم المحدد تلقائياً ليكون اليوم الحالي إن كان دراسياً، وإلا السبت افتراضياً
  const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const SCHED_DAYS = ['SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = DAYS[new Date().getDay()];
    return SCHED_DAYS.includes(d) ? d : 'SATURDAY';
  });

  // التحقق مما إذا كانت المحاضرة تحتوي على تعديلات وتجاوزات نشطة
  const isOverridden = (s) => s.overrides && s.overrides.length > 0;

  // إجراء التصفية الذكية للمحاضرات بناءً على الفلاتر المحددة
  const filteredSchedules = schedules.filter(s => {
    // Group filter
    const matchesGroup = selectedGroupFilter === 'all' ||
      s.groupId === parseInt(selectedGroupFilter) ||
      (s.attendingGroups && s.attendingGroups.some(ag => ag.groupId === parseInt(selectedGroupFilter)));

    // Type filter
    let matchesType = true;
    if (typeFilter === 'theory') {
      matchesType = s.subject?.type === 'THEORY';
    } else if (typeFilter === 'practical') {
      matchesType = s.subject?.type === 'PRACTICAL' || s.subject?.type === 'LAB';
    }

    return matchesGroup && matchesType;
  });

  // تصفية المحاضرات لليوم المحدد لبناء المخطط الزمني اليومي
  const dayLectures = filteredSchedules.filter(s => getActiveDay(s) === selectedDay);
  const sortedDayLecs = [...dayLectures].sort((a, b) => getActiveStartTime(a).localeCompare(getActiveStartTime(b)));

  // بناء خط زمني متصل يضم فترات المحاضرات والاستراحات البينية تلقائياً
  const timelineItems = [];
  for (let i = 0; i < sortedDayLecs.length; i++) {
    timelineItems.push({ type: 'class', data: sortedDayLecs[i] });
    if (i < sortedDayLecs.length - 1) {
      const curEnd = getActiveEndTime(sortedDayLecs[i]);
      const nextStart = getActiveStartTime(sortedDayLecs[i + 1]);
      if (curEnd < nextStart) {
        timelineItems.push({ type: 'break', start: curEnd, end: nextStart });
      }
    }
  }

  const dayLabelsEn = { SATURDAY: 'Sat', SUNDAY: 'Sun', MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu' };
  const dayLabelsAr = { SATURDAY: 'السبت', SUNDAY: 'الأحد', MONDAY: 'الاثنين', TUESDAY: 'الثلاثاء', WEDNESDAY: 'الأربعاء', THURSDAY: 'الخميس' };

  return (
    <div className="space-y-4">
      {/* ── زر التبديل بين العرض اليومي والأسبوعي ── */}
      <div className="flex bg-slate-900/60 p-1 rounded-2xl border border-white/5 gap-1">
        <button
          onClick={() => setScheduleViewMode('daily')}
          className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all ${
            scheduleViewMode === 'daily'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/3'
          }`}
        >
          📅 {isAr ? 'العرض اليومي المتسلسل' : 'Daily Timeline'}
        </button>
        <button
          onClick={() => setScheduleViewMode('weekly')}
          className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all ${
            scheduleViewMode === 'weekly'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/3'
          }`}
        >
          📋 {isAr ? 'الجدول الأسبوعي الكامل' : 'Full Weekly Table'}
        </button>
      </div>

      {/* ── شريط تصفية الجداول حسب الشعبة ── */}
      <div className="flex items-center justify-between bg-slate-950/30 border border-slate-800/80 rounded-xl p-2.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-1">
          {isAr ? 'تصفية الشعبة:' : 'Filter Group:'}
        </span>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-[70%]">
          <button
            onClick={() => setSelectedGroupFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
              selectedGroupFilter === 'all'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            {isAr ? 'الكل' : 'All'}
          </button>
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGroupFilter(g.id.toString())}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                selectedGroupFilter === g.id.toString()
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── شريط تصفية نوع المقرر نظري/عملي ── */}
      <div className="flex items-center justify-between bg-slate-950/30 border border-slate-800/80 rounded-xl p-2.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-1">
          {isAr ? 'نوع المقرر:' : 'Course Type:'}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
              typeFilter === 'all'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            {isAr ? 'الكل' : 'All'}
          </button>
          <button
            onClick={() => setTypeFilter('theory')}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
              typeFilter === 'theory'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            {isAr ? 'نظري' : 'Theory'}
          </button>
          <button
            onClick={() => setTypeFilter('practical')}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
              typeFilter === 'practical'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            {isAr ? 'عملي' : 'Practical'}
          </button>
        </div>
      </div>

      {/* ── العرض الأسبوعي الكامل ── */}
      {scheduleViewMode === 'weekly' ? (
        <div className="space-y-5 pt-2">
          {SCHED_DAYS.map(day => {
            const dayLecs = filteredSchedules.filter(s => getActiveDay(s) === day);
            const sortedLecs = [...dayLecs].sort((a, b) => getActiveStartTime(a).localeCompare(getActiveStartTime(b)));
            
            return (
              <div key={day} className="space-y-2">
                <div className="flex items-center justify-between border-b border-white/5 pb-1">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    {isAr ? dayLabelsAr[day] : day}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {sortedLecs.length} {isAr ? 'محاضرات' : 'lectures'}
                  </span>
                </div>
                
                {sortedLecs.length === 0 ? (
                  <div className="bg-slate-900/10 border border-white/3 rounded-xl py-3 px-4 text-center text-slate-650 text-[10px] font-bold">
                    ☕ {isAr ? 'يوم راحة وخلو من المحاضرات' : 'Rest Day'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sortedLecs.map(lec => {
                      const isTheory = lec.subject.type === 'THEORY';
                      const start = getActiveStartTime(lec);
                      const end = getActiveEndTime(lec);
                      const roomName = (lec.overrides?.[0]?.newRoom?.name || lec.room?.name) || 'N/A';
                      const attending = lec.attendingGroups || [];
                      const isShared = attending.length > 1;
                      
                      const uniqueMajors = Array.from(new Set(attending.map(a => a.majorId).filter(Boolean)));
                      const isSharedAcrossMajors = uniqueMajors.length > 1;
                      
                      let sharedWithText = '';
                      if (isShared) {
                        if (isSharedAcrossMajors) {
                          sharedWithText = isAr ? 'مشترك مع جميع الأقسام' : 'Shared with all departments';
                        } else {
                          sharedWithText = attending
                            .filter(a => a.groupId !== lec.groupId)
                            .map(a => a.groupName)
                            .join(' · ');
                        }
                      }
                      
                      return (
                        <div
                          key={lec.id}
                          className={`p-4 rounded-2xl border transition-all duration-300 hover:bg-white/5 flex flex-col gap-2 relative overflow-hidden ${
                            isTheory
                              ? 'bg-blue-950/10 border-blue-500/10 text-blue-200 border-l-4 border-l-blue-500'
                              : 'bg-emerald-950/10 border-emerald-500/10 text-emerald-200 border-l-4 border-l-emerald-500'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider opacity-85 mb-1">
                              <span>{lec.subject.code}</span>
                              <span className={isTheory ? 'text-blue-400' : 'text-emerald-400'}>
                                {isTheory ? (isAr ? 'نظري' : 'Theory') : (isAr ? 'عملي' : 'Lab')}
                              </span>
                            </div>
                            <h4 className="font-extrabold text-sm text-white leading-tight line-clamp-2">
                              {lec.subject.name}
                            </h4>
                          </div>

                          <div className="text-[11px] text-slate-350 space-y-1.5 font-bold font-sans">
                            <p className="flex items-center gap-1.5">
                              <span className="text-xs">🕒</span>
                              <span>{start} - {end}</span>
                            </p>
                            <p className="flex items-center gap-1.5">
                              <span className="text-xs">🏛️</span>
                              <span>{isAr ? 'قاعة' : 'Room'} {roomName}</span>
                            </p>
                            <p className="flex items-center gap-1.5 truncate">
                              <span className="text-xs">👨‍🏫</span>
                              <span className="text-[var(--accent)] font-extrabold">{lec.lecturerName || (isAr ? 'بدون دكتور مقرر' : 'No Lecturer')}</span>
                            </p>
                          </div>

                          {isShared && sharedWithText && (
                            <div className="mt-1 pt-1.5 border-t border-white/5 text-[9px] text-amber-300 font-black leading-normal">
                              👥 {sharedWithText}
                            </div>
                          )}

                          {(() => {
                            const pendingLectureGoals = goals.filter(g => g.subjectId === lec.subjectId && !g.completed);
                            if (pendingLectureGoals.length > 0) {
                              return (
                                <div className="mt-1.5 pt-1.5 border-t border-white/5 space-y-1">
                                  {pendingLectureGoals.map(g => (
                                    <div key={g.id} className="text-[9px] text-rose-450 font-black leading-normal flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                                      <span>⚠️</span>
                                      <span className="truncate">{g.title}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── العرض اليومي المتسلسل مع فترات الاستراحة ── */
        <div className="space-y-4">
          {/* شريط اختيار اليوم الدراسي */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none" style={{ scrollSnapType: 'x mandatory' }}>
            {SCHED_DAYS.map(day => {
              const active = selectedDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`px-4 py-2.5 rounded-full text-xs font-black tracking-wider uppercase shrink-0 transition-all duration-200 border ${
                    active
                      ? 'bg-emerald-500 border-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 scale-105'
                      : 'bg-slate-850 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  {isAr ? dayLabelsAr[day] : dayLabelsEn[day]}
                </button>
              );
            })}
          </div>

          {/* محتوى اليوم المخطط */}
          <div className="space-y-3 pt-2">
            {timelineItems.length === 0 ? (
              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-8 text-center text-slate-600 text-xs font-bold">
                🎉 {isAr ? 'يوم راحة ممتاز! لا توجد أي محاضرات دراسية اليوم.' : 'Rest day! No lectures scheduled.'}
              </div>
            ) : (
              timelineItems.map((item, index) => {
                // حالة فترة الاستراحة أو الفراغ البيني
                if (item.type === 'break') {
                  return (
                    <div
                      key={`break-${index}`}
                      className="border-2 border-dashed border-slate-800/60 bg-slate-900/10 text-slate-500 py-3.5 px-4 rounded-2xl flex items-center justify-between text-[11px] font-black tracking-wide"
                    >
                      <div className="flex items-center gap-3">
                        <span>☕</span>
                        <span>{isAr ? 'فترة استراحة / راحة بينية' : 'Break / Rest Interval'}</span>
                      </div>
                      <span className="font-mono text-slate-450 font-bold">{item.start} - {item.end}</span>
                    </div>
                  );
                }

                const lec = item.data;
                const isTheory = lec.subject.type === 'THEORY';
                
                return (
                  <div
                    key={lec.id}
                    onClick={() => {
                      // تنشيط نموذج المحاكاة في حال كان وضع المحاكاة (Sandbox Mode) نشطاً
                      if (sandboxMode) {
                        setActiveSimulatorSchedule(lec);
                        setSimulatorDay(lec.dayOfWeek);
                        setSimulatorStart(getActiveStartTime(lec));
                        setSimulatorEnd(getActiveEndTime(lec));
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-all duration-200 ${
                      isTheory
                        ? 'bg-blue-950/10 border-blue-500/20 text-blue-200 hover:shadow-lg hover:shadow-blue-500/5 hover:scale-[1.01]'
                        : 'bg-emerald-950/10 border-emerald-500/20 text-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5 hover:scale-[1.01]'
                    } ${isOverridden(lec) ? 'ring-1 ring-amber-500/40' : ''} ${
                      sandboxMode ? 'cursor-pointer hover:border-amber-400/50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-1 min-w-0">
                        <h4 className="text-sm font-black text-white leading-tight flex items-center gap-1.5 flex-wrap">
                          {lec.subject.name}
                          {lec.group?.name && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300 uppercase">
                              {lec.group.name}
                            </span>
                          )}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-bold">
                          {isAr ? 'المدرس' : 'Lecturer'}: <span className="text-slate-300">{lec.lecturerName}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold">
                          {isAr ? 'القاعة' : 'Room'}: <span className="text-slate-300">{lec.room?.name || 'N/A'}</span>
                        </p>
                        {(() => {
                          const att = lec.attendingGroups || [];
                          const isSh = att.length > 1;
                          const uM = Array.from(new Set(att.map(a => a.majorId).filter(Boolean)));
                          const isShAcross = uM.length > 1;
                          if (isSh) {
                            const shText = isShAcross 
                              ? (isAr ? 'مشترك مع جميع الأقسام' : 'Shared with all departments')
                              : att.filter(a => a.groupId !== lec.groupId).map(a => a.groupName).join(' · ');
                            return (
                              <div className="mt-1.5 text-[9px] text-amber-300 font-black leading-normal flex items-center gap-1">
                                <span>👥</span>
                                <span>{shText}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {(() => {
                          const pendingLectureGoals = goals.filter(g => g.subjectId === lec.subjectId && !g.completed);
                          if (pendingLectureGoals.length > 0) {
                            return (
                              <div className="mt-2 space-y-1">
                                {pendingLectureGoals.map(g => (
                                  <div key={g.id} className="text-[9px] text-rose-450 font-black leading-normal flex items-center gap-1 bg-red-500/10 px-2.5 py-1 rounded border border-red-500/20 w-max max-w-full">
                                    <span>⚠️</span>
                                    <span className="truncate">{g.title}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-slate-200 block">
                          {getActiveStartTime(lec)} - {getActiveEndTime(lec)}
                        </span>
                        <span className={`text-[8px] font-black uppercase tracking-wider block mt-1.5 px-2 py-0.5 rounded border ${
                          isTheory 
                            ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' 
                            : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                        }`}>
                          {isTheory ? (isAr ? 'نظري' : 'Theory') : (isAr ? 'عملي' : 'Practical')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
