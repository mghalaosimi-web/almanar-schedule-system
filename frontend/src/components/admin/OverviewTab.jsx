/**
 * @file OverviewTab.jsx
 * @description تبويب نظرة عامة (Overview) للوحة تحكم المشرف. يعرض المقاييس والتحليلات التنبؤية وإدارة طلبات إعادة الجدولة المعلقة.
 * @author أنتيجرافيتي (Antigravity)
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * مكون عرض تبويب نظرة عامة ونشاط الكلية للمشرفين.
 * 
 * الميزات:
 * 1. عرض بطاقات الإحصائيات الأربع الأساسية (الطلاب، المحاضرات، الأقسام، القاعات).
 * 2. مؤشر صحة حضور الكلية (Attendance Health Ring) الدائري التفاعلي.
 * 3. تحليل هيكلي لأكبر 6 شُعب دراسية حجماً (Group Breakdown).
 * 4. لوحة تفاعلية متكاملة لمراجعة ومعالجة طلبات إعادة الجدولة والإلغاء المقدمة من هيئة التدريس.
 * 
 * @param {Object} props - خصائص المكون.
 * @param {boolean} props.isAr - هل اللغة الحالية هي العربية.
 * @param {Object} props.metrics - كائن أعداد المؤشرات الأربعة (students, lectures, departments, classrooms).
 * @param {Object} props.analytics - كائن التحليلات المتقدمة وصحة الحضور والشعب.
 * @param {boolean} props.analyticsLoading - حالة تحميل التحليلات من الخادم.
 * @param {Array<Object>} props.rescheduleRequests - مصفوفة طلبات إعادة الجدولة المعلقة.
 * @param {boolean} props.requestsLoading - حالة تحميل طلبات المحاضرين.
 * @param {number|string} props.resolvingId - معرف الطلب الجاري معالجته حالياً لإظهار مؤشر الانتظار.
 * @param {Object} props.noteMap - خريطة لملاحظات المشرف المكتوبة لكل طلب.
 * @param {Function} props.setNoteMap - دالة تحديث خريطة الملاحظات.
 * @param {Object} props.dateMap - خريطة للتواريخ المحددة لكل استثناء.
 * @param {Function} props.setDateMap - دالة تحديث خريطة التواريخ.
 * @param {Function} props.handleResolveReschedule - دالة معالجة وحل الطلب (قبول/رفض).
 * @param {Function} props.translateDay - دالة ترجمة أسماء الأيام للعربية.
 */
export default function OverviewTab({
  isAr,
  metrics,
  analytics,
  analyticsLoading,
  rescheduleRequests,
  requestsLoading,
  resolvingId,
  noteMap,
  setNoteMap,
  dateMap,
  setDateMap,
  handleResolveReschedule,
  translateDay
}) {
  return (
    <div className="space-y-8">
      {/* ── لوحة صحة النظام والتحليلات التنبؤية ── */}
      <div className="bg-gradient-to-br from-slate-955 via-slate-900 to-slate-955 border border-slate-800/60 rounded-2xl p-6 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-cyan-500/80">
              {isAr ? 'لوحة الذكاء التحليلي' : 'PREDICTIVE ANALYTICS'}
            </p>
            <h3 className="text-sm font-black text-white mt-0.5">
              {isAr ? 'صحة النظام والأداء الأكاديمي' : 'System Health & Academic Performance'}
            </h3>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            {isAr ? 'آخر ٣٠ يوماً' : 'Last 30 Days'}
          </span>
        </div>

        {analyticsLoading || !analytics ? (
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-slate-800/60" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* حلقة صحة الحضور الدائرية */}
              <div className="flex flex-col items-center justify-center bg-slate-900/60 border border-slate-800 rounded-2xl p-5 gap-2">
                <div className="relative h-20 w-20">
                  <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9"
                      fill="none"
                      stroke={
                        analytics.attendanceHealth === null ? '#475569'
                        : analytics.attendanceHealth >= 80 ? '#10b981'
                        : analytics.attendanceHealth >= 60 ? '#f59e0b'
                        : '#ef4444'
                      }
                      strokeWidth="3"
                      strokeDasharray={`${analytics.attendanceHealth ?? 0} 100`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black text-white">
                      {analytics.attendanceHealth !== null ? `${analytics.attendanceHealth}%` : 'N/A'}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">
                  {isAr ? 'صحة الحضور' : 'Attendance Health'}
                </p>
              </div>

              {/* بطاقة إجمالي الطلاب */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {isAr ? 'الطلاب المقيدون' : 'Enrolled Students'}
                  </p>
                  <h4 className="text-2xl font-black text-white">{analytics.totalStudents}</h4>
                </div>
                <div className="text-2xl bg-cyan-500/10 h-12 w-12 rounded-xl flex items-center justify-center border border-cyan-500/20">
                  🎓
                </div>
              </div>

              {/* بطاقة إجمالي الشُعب */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {isAr ? 'شُعب الدفعات' : 'Academic Groups'}
                  </p>
                  <h4 className="text-2xl font-black text-white">{analytics.totalGroups}</h4>
                </div>
                <div className="text-2xl bg-purple-500/10 h-12 w-12 rounded-xl flex items-center justify-center border border-purple-500/20">
                  👥
                </div>
              </div>

              {/* بطاقة المحاضرات النشطة */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {isAr ? 'الحصص المجدولة' : 'Active Timetables'}
                  </p>
                  <h4 className="text-2xl font-black text-white">{analytics.totalSchedules}</h4>
                </div>
                <div className="text-2xl bg-emerald-500/10 h-12 w-12 rounded-xl flex items-center justify-center border border-emerald-500/20">
                  📅
                </div>
              </div>
            </div>

            {/* تفصيل الشعب الكبرى */}
            <div className="border-t border-slate-800/60 pt-5">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                {isAr ? 'الشعب الأكثر كثافة طلابية' : 'Largest Cohort Groups by Population'}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {analytics.groupBreakdown.map((g) => (
                  <div key={g.groupId} className="bg-slate-950 border border-slate-800/60 rounded-xl p-3.5 text-center">
                    <span className="block text-xs font-black text-white truncate">{g.groupName}</span>
                    <span className="block text-[10px] font-bold text-slate-500 mt-1">
                      {g.studentCount} {isAr ? 'طالب' : 'Students'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── لوحة التحكم الإحصائية الأربعة ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: isAr ? 'الطلاب غير الموثقين' : 'Pending Students', val: metrics.students, color: 'text-amber-400', bg: 'from-amber-500/5 to-transparent', border: 'border-amber-500/10' },
          { label: isAr ? 'المحاضرات النشطة' : 'Active Lectures', val: metrics.lectures, color: 'text-cyan-400', bg: 'from-cyan-500/5 to-transparent', border: 'border-cyan-500/10' },
          { label: isAr ? 'الأقسام الأكاديمية' : 'Departments', val: metrics.departments, color: 'text-purple-400', bg: 'from-purple-500/5 to-transparent', border: 'border-purple-500/10' },
          { label: isAr ? 'القاعات الدراسية' : 'Classrooms', val: metrics.classrooms, color: 'text-emerald-400', bg: 'from-emerald-500/5 to-transparent', border: 'border-emerald-500/10' }
        ].map((c, i) => (
          <div key={i} className={`bg-gradient-to-br ${c.bg} bg-slate-950/60 border ${c.border} rounded-2xl p-6 relative overflow-hidden shadow-lg`}>
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{c.label}</span>
            <span className={`block text-3xl font-black ${c.color} mt-3`}>{c.val}</span>
          </div>
        ))}
      </div>

      {/* ── لوحة طلبات إعادة الجدولة المعلقة المقدمة من المحاضرين ── */}
      <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-sm font-black text-white">{isAr ? 'طلبات تعديل المحاضرات المعلقة' : 'Pending timestable Reschedule Requests'}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1">
              {isAr ? 'طلبات الإلغاء أو تعديل المواعيد والقاعات المرفوعة من هيئة التدريس.' : 'Lecturer submissions requiring immediate resolution.'}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-[9px] font-black text-slate-400">
            {rescheduleRequests.length} {isAr ? 'طلب معلق' : 'Pending'}
          </span>
        </div>

        {requestsLoading ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <div className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500 font-bold">{isAr ? 'جاري تحميل الطلبات...' : 'Fetching requests...'}</span>
          </div>
        ) : rescheduleRequests.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-800/60 rounded-xl bg-slate-950/20">
            <span className="text-2xl block mb-2">📥</span>
            <p className="text-xs font-bold text-slate-500">{isAr ? 'لا توجد طلبات معلقة حالياً.' : 'No pending rescheduling requests at this time.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {rescheduleRequests.map((req) => {
                const isResched = req.requestType === 'RESCHEDULE';
                const isResolving = resolvingId === req.id;
                
                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-5 relative overflow-hidden"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            req.requestType === 'CANCEL' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          }`}>
                            {req.requestType === 'CANCEL' ? (isAr ? 'إلغاء محاضرة' : 'Cancel Class') : (isAr ? 'إعادة جدولة' : 'Reschedule')}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            {new Date(req.createdAt).toLocaleString(isAr ? 'ar' : 'en')}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-slate-200">
                          👤 <strong className="text-white">{req.lecturer?.name}</strong> {isAr ? 'يطلب' : 'requests'}{' '}
                          {req.requestType === 'CANCEL' ? (
                            isAr ? `إلغاء محاضرة [${req.schedule?.subject?.name}]` : `canceling [${req.schedule?.subject?.name}]`
                          ) : (
                            isAr 
                              ? `نقل محاضرة [${req.schedule?.subject?.name}] إلى يوم ${translateDay(req.newDayOfWeek)} (من الساعة ${req.newStartTime} إلى ${req.newEndTime})`
                              : `rescheduling [${req.schedule?.subject?.name}] to ${req.newDayOfWeek} (${req.newStartTime} - ${req.newEndTime})`
                          )}
                        </p>

                        {req.reason && (
                          <div className="text-[11px] text-slate-400 bg-slate-900/60 border border-slate-850 p-3 rounded-lg leading-relaxed">
                            <strong>{isAr ? 'السبب المذكور:' : 'Stated Reason:'}</strong> {req.reason}
                          </div>
                        )}

                        {isResched && (
                          <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-400 bg-slate-900/20 p-3 rounded-lg border border-slate-800/30">
                            <div>
                              <span className="block text-slate-500">{isAr ? 'الموعد الأصلي:' : 'Original Slot:'}</span>
                              <span className="font-bold text-slate-300">
                                {translateDay(req.schedule?.dayOfWeek)} ({req.schedule?.startTime} - {req.schedule?.endTime})
                              </span>
                            </div>
                            <div>
                              <span className="block text-slate-500">{isAr ? 'القاعة البديلة:' : 'Suggested Room:'}</span>
                              <span className="font-bold text-cyan-400">
                                🏫 {req.newRoom?.name || (isAr ? 'نفس القاعة' : 'Same Classroom')}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* لوحة اتخاذ القرار وتعديل المواعيد */}
                      <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
                        {/* مدخل تاريخ الاستثناء وتخصيص القرار */}
                        <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[200px]">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                            {isAr ? 'تاريخ تطبيق التعديل' : 'Effective Date'}
                          </label>
                          <input
                            type="date"
                            value={dateMap[req.id] || ''}
                            onChange={(e) => setDateMap(prev => ({ ...prev, [req.id]: e.target.value }))}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                          />
                        </div>

                        {/* مدخل ملاحظات الأدمن */}
                        <input
                          type="text"
                          placeholder={isAr ? 'ملاحظات وتبرير القرار للمحاضر...' : 'Admin notes and feedback...'}
                          value={noteMap[req.id] || ''}
                          onChange={(e) => setNoteMap(prev => ({ ...prev, [req.id]: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        />

                        {/* أزرار اتخاذ القرار */}
                        <div className="flex gap-2 w-full justify-end">
                          <button
                            disabled={isResolving}
                            onClick={() => handleResolveReschedule(req.id, 'REJECTED', 'TEMPORARY', dateMap[req.id], noteMap[req.id])}
                            className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-xs hover:bg-red-500/20 transition-all disabled:opacity-55"
                          >
                            {isAr ? 'رفض الطلب' : 'Reject'}
                          </button>
                          
                          <button
                            disabled={isResolving}
                            onClick={() => handleResolveReschedule(req.id, 'APPROVED', 'TEMPORARY', dateMap[req.id], noteMap[req.id])}
                            className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-black text-xs hover:shadow-[0_0_15px_var(--accent-glow)] transition-all disabled:opacity-55 flex items-center justify-center gap-1.5"
                          >
                            {isResolving && resolvingId === req.id ? (
                              <span className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <span>{isAr ? 'موافقة وتحديث' : 'Approve & Apply'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
