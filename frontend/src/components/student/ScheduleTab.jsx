/**
 * @file ScheduleTab.jsx
 * @description تبويب جدول المحاضرات الدراسي — HCI Phase 2 Overhaul
 * @author أنتيجرافيتي (Antigravity)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ScheduleTab({
  isAr, schedules, groups, sandboxMode,
  setActiveSimulatorSchedule, setSimulatorDay,
  setSimulatorStart, setSimulatorEnd,
  getActiveDay, getActiveStartTime, getActiveEndTime,
  goals = []
}) {
  const [scheduleViewMode, setScheduleViewMode] = useState('daily');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const SCHED_DAYS = ['SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = DAYS[new Date().getDay()];
    return SCHED_DAYS.includes(d) ? d : 'SATURDAY';
  });

  const isOverridden = (s) => s.overrides && s.overrides.length > 0;

  const filteredSchedules = schedules.filter(s => {
    const matchesGroup = selectedGroupFilter === 'all' ||
      s.groupId === parseInt(selectedGroupFilter) ||
      (s.attendingGroups && s.attendingGroups.some(ag => ag.groupId === parseInt(selectedGroupFilter)));
    let matchesType = true;
    const subjectType = (s.subject?.type || s.type || '').toUpperCase();
    if (typeFilter === 'theory') matchesType = subjectType === 'THEORY';
    else if (typeFilter === 'practical') matchesType = ['PRACTICAL', 'LAB', 'PRACTICE', 'LABORATORY'].includes(subjectType);
    return matchesGroup && matchesType;
  });

  const dayLectures = filteredSchedules.filter(s => getActiveDay(s) === selectedDay);
  const sortedDayLecs = [...dayLectures].sort((a, b) => getActiveStartTime(a).localeCompare(getActiveStartTime(b)));

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

  // حساب عدد المحاضرات لكل يوم لشارة العدد
  const dayCount = (day) => filteredSchedules.filter(s => getActiveDay(s) === day).length;

  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ── 1. مفتاح العرض (Segmented Control) — HCI ── */}
      <div
        className="flex gap-1 p-1 rounded-[16px]"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        role="tablist"
        aria-label={isAr ? 'وضع العرض' : 'View mode'}
      >
        {[
          { id: 'daily', icon: '📅', labelAr: 'جدول اليوم', labelEn: 'Daily' },
          { id: 'weekly', icon: '📋', labelAr: 'الأسبوع كامل', labelEn: 'Weekly' }
        ].map(view => {
          const active = scheduleViewMode === view.id;
          return (
            <button
              key={view.id}
              role="tab"
              aria-selected={active}
              onClick={() => setScheduleViewMode(view.id)}
              className="flex-1 py-2.5 rounded-[12px] text-xs font-black transition-all"
              style={{
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#070b13' : 'var(--text-muted)',
                boxShadow: active ? '0 4px 12px rgba(var(--primary-color-rgb),0.35)' : 'none'
              }}
            >
              {view.icon} {isAr ? view.labelAr : view.labelEn}
            </button>
          );
        })}
      </div>

      {/* ── 2. شريط الفلاتر المدمج ── */}
      <div className="space-y-2">
        {/* فلتر الشعبة */}
        {groups.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: 'var(--text-muted)' }}>
              {isAr ? 'الشعبة:' : 'Group:'}
            </span>
            <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setSelectedGroupFilter('all')}
                className="px-3 py-1 rounded-full text-[9px] font-black whitespace-nowrap transition-all shrink-0"
                style={{
                  background: selectedGroupFilter === 'all' ? 'rgba(var(--primary-color-rgb),0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectedGroupFilter === 'all' ? 'rgba(var(--primary-color-rgb),0.35)' : 'rgba(255,255,255,0.06)'}`,
                  color: selectedGroupFilter === 'all' ? 'var(--accent)' : 'var(--text-muted)'
                }}
              >
                {isAr ? 'الكل' : 'All'}
              </button>
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupFilter(g.id.toString())}
                  className="px-3 py-1 rounded-full text-[9px] font-black whitespace-nowrap transition-all shrink-0"
                  style={{
                    background: selectedGroupFilter === g.id.toString() ? 'rgba(var(--primary-color-rgb),0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedGroupFilter === g.id.toString() ? 'rgba(var(--primary-color-rgb),0.35)' : 'rgba(255,255,255,0.06)'}`,
                    color: selectedGroupFilter === g.id.toString() ? 'var(--accent)' : 'var(--text-muted)'
                  }}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* فلتر النوع */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: 'var(--text-muted)' }}>
            {isAr ? 'النوع:' : 'Type:'}
          </span>
          <div className="flex gap-1.5">
            {[
              { id: 'all', ar: 'الكل', en: 'All' },
              { id: 'theory', ar: 'نظري', en: 'Theory' },
              { id: 'practical', ar: 'عملي', en: 'Lab' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id)}
                className="px-3 py-1 rounded-full text-[9px] font-black transition-all"
                style={{
                  background: typeFilter === t.id ? 'rgba(var(--primary-color-rgb),0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${typeFilter === t.id ? 'rgba(var(--primary-color-rgb),0.35)' : 'rgba(255,255,255,0.06)'}`,
                  color: typeFilter === t.id ? 'var(--accent)' : 'var(--text-muted)'
                }}
              >
                {isAr ? t.ar : t.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3. العرض الأسبوعي ── */}
      <AnimatePresence mode="wait">
        {scheduleViewMode === 'weekly' ? (
          <motion.div
            key="weekly"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            className="space-y-5 pt-1"
          >
            {SCHED_DAYS.map(day => {
              const dayLecs = filteredSchedules.filter(s => getActiveDay(s) === day);
              const sortedLecs = [...dayLecs].sort((a, b) => getActiveStartTime(a).localeCompare(getActiveStartTime(b)));
              const isToday = DAYS[new Date().getDay()] === day;

              return (
                <div key={day} className="space-y-2">
                  {/* رأس اليوم */}
                  <div
                    className="flex items-center gap-2 py-2 px-3 rounded-[12px]"
                    style={{
                      background: isToday ? 'rgba(var(--primary-color-rgb),0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isToday ? 'rgba(var(--primary-color-rgb),0.2)' : 'rgba(255,255,255,0.04)'}`,
                    }}
                  >
                    {isToday && <span className="live-dot" />}
                    <span
                      className="text-[11px] font-black"
                      style={{ color: isToday ? 'var(--accent)' : 'var(--text-secondary)' }}
                    >
                      {isAr ? dayLabelsAr[day] : day}
                    </span>
                    {isToday && (
                      <span className="chip chip-accent" style={{ fontSize: '8px' }}>
                        {isAr ? 'اليوم' : 'Today'}
                      </span>
                    )}
                    <span className="ms-auto chip chip-slate">
                      {sortedLecs.length} {isAr ? 'محاضرات' : 'classes'}
                    </span>
                  </div>

                  {sortedLecs.length === 0 ? (
                    <div
                      className="py-3 px-4 rounded-[12px] text-center text-[10px] font-bold"
                      style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)' }}
                    >
                      ☕ {isAr ? 'يوم راحة' : 'Rest Day'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {sortedLecs.map(lec => {
                        const isTheory = lec.subject.type === 'THEORY';
                        const start = getActiveStartTime(lec);
                        const end = getActiveEndTime(lec);
                        const roomName = (lec.overrides?.[0]?.newRoom?.name || lec.room?.name) || 'N/A';
                        const attending = lec.attendingGroups || [];
                        const isShared = attending.length > 1;
                        const uniqueMajors = Array.from(new Set(attending.map(a => a.majorId).filter(Boolean)));
                        const isSharedAcrossMajors = uniqueMajors.length > 1;
                        const sharedWithText = isShared
                          ? (isSharedAcrossMajors
                            ? (isAr ? 'مشترك مع جميع الأقسام' : 'Shared with all departments')
                            : attending.filter(a => a.groupId !== lec.groupId).map(a => a.groupName).join(' · '))
                          : '';
                        const pendingGoals = goals.filter(g => g.subjectId === lec.subjectId && !g.completed);

                        return (
                          <div
                            key={lec.id}
                            className="rounded-[16px] overflow-hidden"
                            style={{
                              background: 'var(--bg-card)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              borderInlineStart: `3px solid ${isTheory ? '#2979ff' : '#10b981'}`
                            }}
                          >
                            <div className="p-3 flex justify-between items-start gap-2">
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: isTheory ? '#60a5fa' : '#34d399' }}>
                                    {lec.subject.code}
                                  </span>
                                  <span
                                    className="chip"
                                    style={{
                                      background: isTheory ? 'rgba(41,121,255,0.1)' : 'rgba(16,185,129,0.1)',
                                      border: `1px solid ${isTheory ? 'rgba(41,121,255,0.25)' : 'rgba(16,185,129,0.25)'}`,
                                      color: isTheory ? '#60a5fa' : '#34d399',
                                      fontSize: '8px', fontWeight: 800
                                    }}
                                  >
                                    {isTheory ? (isAr ? 'نظري' : 'Theory') : (isAr ? 'عملي' : 'Lab')}
                                  </span>
                                </div>
                                <p className="text-[12px] font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
                                  {lec.subject.name}
                                </p>
                                <div className="flex items-center gap-3 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                                  <span>🕒 {start} – {end}</span>
                                  <span>🏛️ {roomName}</span>
                                </div>
                                {lec.lecturerName && (
                                  <p className="text-[10px] font-bold" style={{ color: 'var(--accent)' }}>
                                    👨‍🏫 {lec.lecturerName}
                                  </p>
                                )}
                                {isShared && sharedWithText && (
                                  <p className="text-[9px] font-black mt-1" style={{ color: '#fbbf24' }}>
                                    👥 {sharedWithText}
                                  </p>
                                )}
                                {pendingGoals.length > 0 && (
                                  <div className="mt-1.5 space-y-1">
                                    {pendingGoals.map(g => (
                                      <div
                                        key={g.id}
                                        className="flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-[8px]"
                                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                                      >
                                        ⚠️ <span className="truncate">{g.title}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        ) : (
          /* ── العرض اليومي ── */
          <motion.div
            key="daily"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            className="space-y-4"
          >
            {/* شريط اختيار اليوم — Pill Day Selector */}
            <div
              className="flex gap-2 pb-1 overflow-x-auto"
              style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
              role="group"
              aria-label={isAr ? 'اختر اليوم' : 'Select day'}
            >
              {SCHED_DAYS.map(day => {
                const active = selectedDay === day;
                const isToday = DAYS[new Date().getDay()] === day;
                const count = dayCount(day);
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className="flex flex-col items-center gap-1 px-3 pt-2 pb-2 rounded-[16px] shrink-0 transition-all"
                    style={{
                      scrollSnapAlign: 'start',
                      background: active ? 'var(--accent)' : isToday ? 'rgba(var(--primary-color-rgb),0.08)' : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${active ? 'var(--accent)' : isToday ? 'rgba(var(--primary-color-rgb),0.25)' : 'rgba(255,255,255,0.06)'}`,
                      boxShadow: active ? '0 4px 12px rgba(var(--primary-color-rgb),0.3)' : 'none',
                      minWidth: '52px'
                    }}
                  >
                    <span
                      className="text-[9px] font-black uppercase"
                      style={{ color: active ? '#070b13' : isToday ? 'var(--accent)' : 'var(--text-muted)' }}
                    >
                      {isAr ? dayLabelsAr[day].substring(0, 3) : dayLabelsEn[day]}
                    </span>
                    <span
                      className="text-[11px] font-black"
                      style={{ color: active ? '#070b13' : isToday ? 'var(--accent)' : 'var(--text-primary)' }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* رأس اليوم المحدد */}
            <div className="section-header">
              <div>
                <h3 className="section-title">
                  {isAr ? dayLabelsAr[selectedDay] : selectedDay}
                </h3>
                <p className="section-subtitle">
                  {timelineItems.filter(i => i.type === 'class').length} {isAr ? 'محاضرات' : 'lectures'}
                  {sandboxMode && (
                    <span className="chip chip-accent ms-2">
                      🧪 {isAr ? 'وضع المحاكاة' : 'Sandbox'}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* محتوى الجدول اليومي */}
            <div className="space-y-2.5 relative">
              {/* خط الوقت العمودي */}
              {timelineItems.length > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-px"
                  style={{
                    [isAr ? 'right' : 'left']: '43px',
                    background: 'linear-gradient(180deg, rgba(var(--primary-color-rgb),0.3) 0%, transparent 100%)'
                  }}
                  aria-hidden="true"
                />
              )}

              {timelineItems.length === 0 ? (
                <div className="card-subtle p-8 text-center space-y-2">
                  <span style={{ fontSize: '28px' }}>🎉</span>
                  <p className="text-[12px] font-black" style={{ color: 'var(--text-secondary)' }}>
                    {isAr ? 'لا توجد محاضرات هذا اليوم' : 'No lectures today!'}
                  </p>
                </div>
              ) : (
                timelineItems.map((item, idx) => {
                  if (item.type === 'break') {
                    return (
                      <div
                        key={`break-${idx}`}
                        className="flex items-center gap-3 py-2.5 px-3 rounded-[14px] ms-14"
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1.5px dashed rgba(255,255,255,0.08)'
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>☕</span>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                          {isAr ? 'استراحة' : 'Break'} · {item.start} – {item.end}
                        </span>
                      </div>
                    );
                  }

                  const lec = item.data;
                  const isTheory = lec.subject.type === 'THEORY';
                  const pendingGoals = goals.filter(g => g.subjectId === lec.subjectId && !g.completed);
                  const attending = lec.attendingGroups || [];
                  const isShared = attending.length > 1;
                  const uniqueMajors = Array.from(new Set(attending.map(a => a.majorId).filter(Boolean)));
                  const sharedText = uniqueMajors.length > 1
                    ? (isAr ? 'مشترك مع جميع الأقسام' : 'Shared with all departments')
                    : attending.filter(a => a.groupId !== lec.groupId).map(a => a.groupName).join(' · ');

                  return (
                    <motion.div
                      key={lec.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.2 }}
                      className="flex gap-3"
                    >
                      {/* وقت البدء على الجانب */}
                      <div
                        className="shrink-0 flex flex-col items-center"
                        style={{ width: '40px' }}
                      >
                        <span
                          className="text-[9px] font-black font-mono"
                          style={{ color: 'var(--accent)' }}
                        >
                          {getActiveStartTime(lec)}
                        </span>
                        <div
                          className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                          style={{
                            background: isTheory ? '#2979ff' : '#10b981',
                            boxShadow: isTheory ? '0 0 8px rgba(41,121,255,0.5)' : '0 0 8px rgba(16,185,129,0.5)'
                          }}
                        />
                      </div>

                      {/* بطاقة المحاضرة */}
                      <div
                        onClick={() => {
                          if (sandboxMode) {
                            setActiveSimulatorSchedule(lec);
                            setSimulatorDay(lec.dayOfWeek);
                            setSimulatorStart(getActiveStartTime(lec));
                            setSimulatorEnd(getActiveEndTime(lec));
                          }
                        }}
                        className="flex-1 rounded-[18px] p-3.5 transition-all"
                        style={{
                          background: 'var(--bg-card)',
                          border: `1px solid ${isOverridden(lec) ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.05)'}`,
                          borderInlineStart: `3px solid ${isTheory ? '#2979ff' : '#10b981'}`,
                          cursor: sandboxMode ? 'pointer' : 'default',
                          boxShadow: isOverridden(lec) ? '0 0 16px rgba(245,158,11,0.08)' : '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                        role={sandboxMode ? 'button' : undefined}
                        aria-label={sandboxMode ? `${isAr ? 'محاكاة' : 'Simulate'} ${lec.subject.name}` : undefined}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="chip"
                                style={{
                                  background: isTheory ? 'rgba(41,121,255,0.1)' : 'rgba(16,185,129,0.1)',
                                  border: `1px solid ${isTheory ? 'rgba(41,121,255,0.25)' : 'rgba(16,185,129,0.25)'}`,
                                  color: isTheory ? '#60a5fa' : '#34d399',
                                  fontSize: '8px', fontWeight: 800
                                }}
                              >
                                {isTheory ? (isAr ? 'نظري' : 'Theory') : (isAr ? 'عملي' : 'Lab')}
                              </span>
                              {isOverridden(lec) && (
                                <span className="chip chip-accent" style={{ fontSize: '8px' }}>
                                  ✏️ {isAr ? 'معدّل' : 'Modified'}
                                </span>
                              )}
                              {sandboxMode && (
                                <span className="chip" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24', fontSize: '8px', fontWeight: 800 }}>
                                  🧪
                                </span>
                              )}
                            </div>
                            <p className="text-[13px] font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
                              {lec.subject.name}
                            </p>
                            {lec.lecturerName && (
                              <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                                👨‍🏫 {lec.lecturerName}
                              </p>
                            )}
                            {lec.group?.name && (
                              <p className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>
                                👥 {lec.group.name}
                              </p>
                            )}
                            {isShared && sharedText && (
                              <p className="text-[9px] font-black" style={{ color: '#fbbf24' }}>
                                🔗 {sharedText}
                              </p>
                            )}
                          </div>

                          {/* وقت + قاعة */}
                          <div className="shrink-0 text-end space-y-1">
                            <span className="text-[9.5px] font-bold font-mono block" style={{ color: 'var(--text-secondary)' }}>
                              {getActiveStartTime(lec)}–{getActiveEndTime(lec)}
                            </span>
                            <span className="chip chip-slate block text-center" style={{ fontSize: '9px' }}>
                              {lec.overrides?.[0]?.newRoom?.name || lec.room?.name || 'N/A'}
                            </span>
                          </div>
                        </div>

                        {pendingGoals.length > 0 && (
                          <div className="mt-2.5 pt-2 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            {pendingGoals.slice(0, 2).map(g => (
                              <div
                                key={g.id}
                                className="flex items-center gap-1.5 text-[9px] font-black px-2 py-1 rounded-[8px]"
                                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}
                              >
                                ⚠️ <span className="truncate">{g.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
