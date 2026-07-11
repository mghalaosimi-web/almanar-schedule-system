/**
 * @file ScheduleTab.jsx
 * @description تبويب لوحة الجدولة (Schedule) في لوحة تحكم المشرف. يوفر لوحة جدولة تفاعلية (Kanban) مع السحب والإفلات وتجربة منع التضارب.
 * @author أنتيجرافيتي (Antigravity)
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DAYS = ['SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
const TIME_SLOTS = [
  { start: '08:00', end: '10:00', label: '08:00 AM - 10:00 AM' },
  { start: '10:00', end: '12:00', label: '10:00 AM - 12:00 PM' },
  { start: '12:00', end: '14:00', label: '12:00 PM - 02:00 PM' },
  { start: '14:00', end: '16:00', label: '02:00 PM - 04:00 PM' },
  { start: '16:00', end: '18:00', label: '04:00 PM - 06:00 PM' },
];

/**
 * مكون لوحة الجدولة وإدارة الحصص التفاعلي (Kanban Grid).
 * 
 * الميزات:
 * 1. فلاتر التصفية التعاقبية (Major -> Level -> Group) لتتبع جداول الشعب بدقة.
 * 2. جدول الحصص الشبكي التفاعلي المقسم حسب الأيام والفتحات الزمنية الخمس.
 * 3. سحب كروت المحاضرات وإفلاتها لنقل المحاضرات تلقائياً وتوجيه التنبيهات.
 * 4. نافذة المشاكل وتأكيد الاستثناءات (Temporary vs Permanent).
 * 5. استعلام القاعات الفارغة وتتبع انشغال الغرف (Classroom Occupancy).
 * 
 * @param {Object} props - خصائص المكون.
 */
export default function ScheduleTab({
  isAr,
  loading,
  schedules,
  groups,
  isRoomModalOpen,
  setIsRoomModalOpen,
  roomsList,
  roomsLoading,
  roomSearchQuery,
  setRoomSearchQuery,
  schedMajor,
  setSchedMajor,
  schedLevel,
  setSchedLevel,
  schedGroup,
  setSchedGroup,
  filteredSchedules,
  handleDragStart,
  handleDragOver,
  handleDrop,
  overrideConfirmData,
  setOverrideConfirmData,
  executeOverride,
  isAddScheduleOpen,
  setIsAddScheduleOpen,
  newScheduleForm,
  setNewScheduleForm,
  handleAddSchedule,
  isEditScheduleOpen,
  setIsEditScheduleOpen,
  editingSchedule,
  setEditingSchedule,
  editScheduleForm,
  setEditScheduleForm,
  handleEditSchedule,
  handleDeleteSchedule,
  handleOpenEdit,
  translateDay,
  getActiveDay,
  getActiveStartTime,
  getActiveEndTime,
  isSuperAdmin,
  token,
  API_URL
}) {
  const [lecturers, setLecturers] = useState([]);
  const [lecturersLoading, setLecturersLoading] = useState(false);

  useEffect(() => {
    const fetchLecturers = async () => {
      setLecturersLoading(true);
      try {
        let url = `${API_URL}/api/admin/lecturers`;
        if (isSuperAdmin) {
          const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
          if (selCollegeId) url += `?collegeId=${selCollegeId}`;
        }
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data?.success) {
          setLecturers(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch lecturers', err);
      } finally {
        setLecturersLoading(false);
      }
    };
    fetchLecturers();
  }, [API_URL, token, isSuperAdmin]);

  // تجميع القوائم المستخرجة للفلاتر بناءً على علاقات المجموعات
  const schedMajors = Array.from(
    new Map(groups.map(g => [g.major?.id, g.major]).filter(([id]) => id)).values()
  );
  const schedLevels = Array.from(
    new Map(
      groups
        .filter(g => schedMajor === 'ALL' || String(g.major?.id) === schedMajor)
        .map(g => [g.level?.id, g.level])
        .filter(([id]) => id)
    ).values()
  );
  const schedGroups = groups.filter(g =>
    (schedMajor === 'ALL' || String(g.major?.id) === schedMajor) &&
    (schedLevel === 'ALL' || String(g.level?.id) === schedLevel)
  );

  React.useEffect(() => {
    if (schedMajor === 'ALL' && schedMajors.length > 0) {
      setSchedMajor(String(schedMajors[0].id));
    }
  }, [schedMajors, schedMajor, setSchedMajor]);

  React.useEffect(() => {
    if (schedLevel === 'ALL' && schedLevels.length > 0) {
      setSchedLevel(String(schedLevels[0].id));
    }
  }, [schedLevels, schedLevel, setSchedLevel]);

  return (
    <div className="space-y-6">
      {/* ── شريط الفلاتر والأدوات ── */}
      <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col gap-5 shadow-md">
        
        {/* فلتر التخصص (أزرار) */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            {isAr ? 'التخصص الدراسي (القسم)' : 'Academic Specialization (Major)'}
          </span>
          <div className="flex flex-wrap gap-2">
            {schedMajors.map(m => {
              const isSelected = String(m.id) === schedMajor;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSchedMajor(String(m.id));
                    setSchedGroup('ALL');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 border ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.3)] font-extrabold'
                      : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* الصف الثاني: المستوى + الشعبة + أزرار الإجراءات */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pt-3 border-t border-slate-900">
          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            {/* فلتر المستوى (أزرار) */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {isAr ? 'المستوى الدراسي' : 'Academic Level'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {schedLevels.map(l => {
                  const isSelected = String(l.id) === schedLevel;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        setSchedLevel(String(l.id));
                        setSchedGroup('ALL');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all duration-200 border ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.25)] font-extrabold'
                          : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* خط فاصل عمودي في الشاشات الكبيرة */}
            <div className="hidden lg:block h-10 w-px bg-slate-900 align-middle self-end mb-1" />

            {/* فلتر الشعبة (أزرار صغيرة) */}
            {schedGroups.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {isAr ? 'الشعبة' : 'Group'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSchedGroup('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all duration-200 border ${
                      schedGroup === 'ALL'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)] font-extrabold'
                        : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {isAr ? 'كل الشعب' : 'All Groups'}
                  </button>
                  {schedGroups.map(g => {
                    const isSelected = String(g.id) === schedGroup;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSchedGroup(String(g.id))}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all duration-200 border ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)] font-extrabold'
                            : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-end self-end mt-2 lg:mt-0">
            <button
              onClick={() => setIsRoomModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors"
            >
              🏫 {isAr ? 'انشغال القاعات' : 'Classroom Occupancy'}
            </button>
            
            <button
              onClick={() => setIsAddScheduleOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-black text-xs hover:shadow-[0_0_15px_var(--accent-glow)] transition-all"
            >
              ➕ {isAr ? 'إضافة حصة دراسية' : 'Add New Lecture'}
            </button>
          </div>
        </div>
      </div>

      {/* ── شبكة الجدولة التفاعلية (Kanban Table) ── */}
      {loading ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <div className="h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-bold">{isAr ? 'جاري تجميع الخلايا المجدولة...' : 'Assembling timetable matrix...'}</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/20 shadow-xl">
          <table className="w-full border-collapse text-xs text-slate-400 min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-850 bg-slate-950/60">
                <th className="p-4 text-start font-black text-white w-28 border-r border-slate-850">
                  {isAr ? 'اليوم الدراسي' : 'Day / Slots'}
                </th>
                {TIME_SLOTS.map((slot, i) => (
                  <th key={i} className="p-4 text-center font-black text-slate-300 border-r border-slate-850 last:border-0">
                    <span className="block text-[10px] text-slate-500 uppercase tracking-widest">{isAr ? `الفترة ${i+1}` : `Slot ${i+1}`}</span>
                    <span className="block font-mono text-[11px] mt-0.5">{slot.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr
                  key={day}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                  className="border-b border-slate-900 hover:bg-slate-950/10 transition-colors group last:border-0"
                >
                  {/* عمود اسم اليوم الدراسي */}
                  <td className="p-4 font-black text-slate-300 border-r border-slate-900 bg-slate-950/20">
                    {translateDay(day)}
                  </td>
                  
                  {/* الفترات الزمنية الخمس */}
                  {TIME_SLOTS.map((slot) => {
                    // العثور على المحاضرات التي تبدأ في هذه الفترة الزمنية وفي هذا اليوم
                    const slotLectures = filteredSchedules.filter((s) => {
                      return getActiveDay(s) === day && getActiveStartTime(s) === slot.start;
                    });

                    return (
                      <td key={slot.start} className="p-2 border-r border-slate-900/60 last:border-0 align-top min-h-[110px]">
                        <div className="space-y-2">
                          {slotLectures.map((sched) => {
                            const isTemp = sched.overrides && sched.overrides.length > 0 && sched.overrides[sched.overrides.length - 1].overrideType === 'TEMPORARY';
                            
                            return (
                              <div
                                key={sched.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, sched)}
                                onClick={() => handleOpenEdit(sched)}
                                className={`p-2.5 rounded-xl border cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02] ${
                                  isTemp
                                    ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.04)]'
                                    : 'bg-slate-950 border-slate-850 hover:border-slate-700 shadow-md'
                                }`}
                              >
                                <div className="font-bold text-white truncate">{sched.subject?.name}</div>
                                <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1.5">
                                  <span>🏫 {sched.room?.name}</span>
                                  <span className="font-mono text-[9px] text-cyan-500 bg-cyan-950/30 border border-cyan-900/25 px-1.5 py-0.5 rounded">
                                    {sched.group?.name}
                                  </span>
                                </div>
                                <div className="text-[9px] text-slate-500 truncate mt-1">
                                  👤 {sched.lecturerName}
                                </div>
                                {isTemp && (
                                  <div className="text-[8px] font-black text-amber-500 uppercase tracking-widest mt-1.5 animate-pulse">
                                    ⚠️ {isAr ? 'تعديل استثنائي مؤقت' : 'Temporary Override'}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── نافذة تأكيد الاستثناء للجدول (Override Confirmation Modal) ── */}
      <AnimatePresence>
        {overrideConfirmData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-slate-955 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center"
            >
              <span className="text-3xl block mb-2">📅</span>
              <h3 className="text-base font-black text-white mb-2">{isAr ? 'تحديث موعد الحصة الأكاديمية' : 'TIMETABLE SWAP EXCEPTION'}</h3>
              <p className="text-xs text-slate-400 mb-6 font-bold leading-relaxed">
                {isAr
                  ? `لقد قمت بسحب الحصة وإفلاتها ليوم [${translateDay(overrideConfirmData.targetDay)}]. هل ترغب في تطبيق هذا التغيير كاستثناء مؤقت (لهذا الأسبوع فقط) أم كتغيير دائم في الجدول الأساسي؟`
                  : `You have moved the lecture to [${overrideConfirmData.targetDay}]. Apply this exception as a temporary adjustment for this week only, or make it permanent?`}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setOverrideConfirmData(null)}
                  className="py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-855 transition-colors"
                >
                  {isAr ? 'إلغاء الأمر' : 'Cancel'}
                </button>
                <button
                  onClick={() => executeOverride('TEMPORARY')}
                  className="py-2.5 rounded-lg bg-amber-500 text-slate-950 font-black text-xs hover:shadow-[0_0_12px_rgba(245,158,11,0.3)] transition-all"
                >
                  {isAr ? 'مؤقت فقط' : 'Temporary'}
                </button>
                <button
                  onClick={() => executeOverride('PERMANENT')}
                  className="py-2.5 rounded-lg bg-cyan-500 text-slate-950 font-black text-xs hover:shadow-[0_0_12px_rgba(34,211,238,0.3)] transition-all"
                >
                  {isAr ? 'دائم وثابت' : 'Permanent'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── نافذة إضافة محاضرة جديدة (Add Schedule Modal) ── */}
      <AnimatePresence>
        {isAddScheduleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-lg bg-slate-955 border border-slate-850 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-start"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black text-white">{isAr ? 'إدراج حصة جديدة بالجدول الأكاديمي' : 'Add Timetable Lecture Slot'}</h3>
                <button onClick={() => setIsAddScheduleOpen(false)} className="text-slate-500 hover:text-white text-xs">✕</button>
              </div>

              <form onSubmit={handleAddSchedule} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'اسم المادة' : 'Subject Name'}</label>
                    <input
                      type="text"
                      required
                      value={newScheduleForm.subjectName}
                      onChange={e => setNewScheduleForm(p => ({ ...p, subjectName: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      placeholder={isAr ? 'الذكاء الاصطناعي' : 'Artificial Intelligence'}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'رمز المادة' : 'Subject Code'}</label>
                    <input
                      type="text"
                      required
                      value={newScheduleForm.subjectCode}
                      onChange={e => setNewScheduleForm(p => ({ ...p, subjectCode: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      placeholder="AI-401"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'نوع المادة' : 'Subject Type'}</label>
                    <select
                      value={newScheduleForm.subjectType}
                      onChange={e => setNewScheduleForm(p => ({ ...p, subjectType: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="THEORY">{isAr ? 'نظري' : 'Theory'}</option>
                      <option value="PRACTICAL">{isAr ? 'عملي' : 'Practical'}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'القاعة الدراسية' : 'Classroom'}</label>
                    <input
                      type="text"
                      required
                      value={newScheduleForm.roomName}
                      onChange={e => setNewScheduleForm(p => ({ ...p, roomName: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      placeholder={isAr ? 'قاعة ١' : 'Hall 1'}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'سعة القاعة' : 'Room Capacity'}</label>
                    <input
                      type="number"
                      required
                      value={newScheduleForm.roomCapacity}
                      onChange={e => setNewScheduleForm(p => ({ ...p, roomCapacity: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      placeholder="45"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'عضو هيئة التدريس (المحاضر)' : 'Lecturer'}</label>
                    <select
                      required
                      value={newScheduleForm.lecturerId}
                      onChange={e => {
                        const sel = lecturers.find(l => l.id === parseInt(e.target.value));
                        setNewScheduleForm(p => ({ ...p, lecturerId: e.target.value, lecturerName: sel ? sel.name : '' }));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="">{isAr ? 'اختر المدرس...' : 'Select Lecturer...'}</option>
                      {lecturers.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'الشعبة الأكاديمية المستهدفة' : 'Target Class Group'}</label>
                    <input
                      type="text"
                      required
                      value={newScheduleForm.groupName}
                      onChange={e => setNewScheduleForm(p => ({ ...p, groupName: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      placeholder={isAr ? 'الشعبة أ' : 'Group A'}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'اليوم' : 'Day of Week'}</label>
                    <select
                      value={newScheduleForm.dayOfWeek}
                      onChange={e => setNewScheduleForm(p => ({ ...p, dayOfWeek: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      {DAYS.map(d => (
                        <option key={d} value={d}>{translateDay(d)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'الفترة الزمنية' : 'Time Slot'}</label>
                    <select
                      value={newScheduleForm.timeSlotIndex}
                      onChange={e => setNewScheduleForm(p => ({ ...p, timeSlotIndex: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      {TIME_SLOTS.map((s, idx) => (
                        <option key={idx} value={String(idx)}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddScheduleOpen(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-855 transition-colors"
                  >
                    {isAr ? 'إلغاء الأمر' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-cyan-500 text-slate-950 font-black text-xs hover:shadow-[0_0_20px_var(--accent-glow)] transition-all"
                  >
                    {isAr ? 'إدراج الحصة بالجدول' : 'Create Timetable Entry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── نافذة تعديل / حذف محاضرة قائمة (Edit Schedule Modal) ── */}
      <AnimatePresence>
        {isEditScheduleOpen && editingSchedule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-lg bg-slate-955 border border-slate-850 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-start"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black text-white">{isAr ? 'تعديل بيانات الحصة المجدولة' : 'Edit Timetable Lecture'}</h3>
                <button onClick={() => { setIsEditScheduleOpen(false); setEditingSchedule(null); }} className="text-slate-500 hover:text-white text-xs">✕</button>
              </div>

              <form onSubmit={handleEditSchedule} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'اسم المادة' : 'Subject Name'}</label>
                    <input
                      type="text"
                      required
                      value={editScheduleForm.subjectName}
                      onChange={e => setEditScheduleForm(p => ({ ...p, subjectName: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'رمز المادة' : 'Subject Code'}</label>
                    <input
                      type="text"
                      required
                      value={editScheduleForm.subjectCode}
                      onChange={e => setEditScheduleForm(p => ({ ...p, subjectCode: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'نوع المادة' : 'Subject Type'}</label>
                    <select
                      value={editScheduleForm.subjectType}
                      onChange={e => setEditScheduleForm(p => ({ ...p, subjectType: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="THEORY">{isAr ? 'نظري' : 'Theory'}</option>
                      <option value="PRACTICAL">{isAr ? 'عملي' : 'Practical'}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'القاعة الدراسية' : 'Classroom'}</label>
                    <input
                      type="text"
                      required
                      value={editScheduleForm.roomName}
                      onChange={e => setEditScheduleForm(p => ({ ...p, roomName: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'سعة القاعة' : 'Room Capacity'}</label>
                    <input
                      type="number"
                      required
                      value={editScheduleForm.roomCapacity}
                      onChange={e => setEditScheduleForm(p => ({ ...p, roomCapacity: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'عضو هيئة التدريس (المحاضر)' : 'Lecturer'}</label>
                    <select
                      required
                      value={editScheduleForm.lecturerId}
                      onChange={e => {
                        const sel = lecturers.find(l => l.id === parseInt(e.target.value));
                        setEditScheduleForm(p => ({ ...p, lecturerId: e.target.value, lecturerName: sel ? sel.name : '' }));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="">{isAr ? 'اختر المدرس...' : 'Select Lecturer...'}</option>
                      {lecturers.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'الشعبة الأكاديمية' : 'Target Class Group'}</label>
                    <input
                      type="text"
                      required
                      value={editScheduleForm.groupName}
                      onChange={e => setEditScheduleForm(p => ({ ...p, groupName: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'اليوم' : 'Day of Week'}</label>
                    <select
                      value={editScheduleForm.dayOfWeek}
                      onChange={e => setEditScheduleForm(p => ({ ...p, dayOfWeek: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      {DAYS.map(d => (
                        <option key={d} value={d}>{translateDay(d)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">{isAr ? 'الفترة الزمنية' : 'Time Slot'}</label>
                    <select
                      value={editScheduleForm.timeSlotIndex}
                      onChange={e => setEditScheduleForm(p => ({ ...p, timeSlotIndex: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      {TIME_SLOTS.map((s, idx) => (
                        <option key={idx} value={String(idx)}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleDeleteSchedule}
                    className="py-3 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-black text-xs hover:bg-red-500/20 transition-all sm:w-28 text-center"
                  >
                    🗑️ {isAr ? 'حذف كلي' : 'Delete'}
                  </button>
                  <div className="flex-1 flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setIsEditScheduleOpen(false); setEditingSchedule(null); }}
                      className="flex-1 py-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-855 transition-colors"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-slate-950 font-black text-xs hover:shadow-[0_0_20px_var(--accent-glow)] transition-all"
                    >
                      💾 {isAr ? 'حفظ التعديلات' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── نافذة انشغال القاعات وتتبع السعة (Classroom Occupancy Modal) ── */}
      <AnimatePresence>
        {isRoomModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-2xl bg-slate-955 border border-slate-850 rounded-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col text-start"
            >
              <div className="flex justify-between items-center mb-5 shrink-0">
                <div>
                  <h3 className="text-sm font-black text-white">{isAr ? 'مخطط تتبع انشغال قاعات الكلية' : 'College Classrooms Occupancy Tracker'}</h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-1">
                    {isAr ? 'قائمة بالقاعات الدراسية وسعتها الحالية لتجنب التضارب المرفق.' : 'Live capacity limits to verify room schedules.'}
                  </p>
                </div>
                <button onClick={() => setIsRoomModalOpen(false)} className="text-slate-500 hover:text-white text-xs">✕</button>
              </div>

              {/* مدخل البحث عن القاعة */}
              <div className="mb-4 shrink-0">
                <input
                  type="text"
                  placeholder={isAr ? 'البحث عن قاعة (مثال: قاعة ١)...' : 'Search for a room (e.g. Hall 1)...'}
                  value={roomSearchQuery}
                  onChange={(e) => setRoomSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {roomsLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 gap-3">
                  <div className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-slate-500 font-bold">{isAr ? 'جاري تتبع الغرف...' : 'Loading classrooms...'}</span>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {roomsList
                    .filter(r => r.name.toLowerCase().includes(roomSearchQuery.toLowerCase()))
                    .map((room) => (
                      <div key={room.id} className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <span className="block text-xs font-black text-white">🏫 {room.name}</span>
                          <span className="block text-[10px] text-slate-500 mt-1">
                            {isAr ? `السعة الاستيعابية القصوى: ${room.capacity} طالب` : `Maximum Capacity: ${room.capacity} Students`}
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] font-black uppercase tracking-wider">
                          {isAr ? 'نشطة ومتوفرة' : 'ACTIVE'}
                        </span>
                      </div>
                    ))}
                  {roomsList.filter(r => r.name.toLowerCase().includes(roomSearchQuery.toLowerCase())).length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-xs text-slate-500 font-bold">{isAr ? 'لا توجد قاعات مطابقة لبحثك.' : 'No classrooms found matching search.'}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
