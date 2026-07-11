/**
 * @file ExamsTab.jsx
 * @description تبويب إدارة الامتحانات (Exams Management) في لوحة تحكم المشرف.
 * يتيح عرض وإدارة وإضافة جداول الامتحانات النهائية وتفاصيل توزيع القاعات والشعب.
 * @author أنتيجرافيتي (Antigravity)
 */

import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { API_URL } from '../../config';

/**
 * مكون إدارة الامتحانات النهائية.
 * 
 * الميزات:
 * 1. عرض جدول الامتحانات في هيئة جدول منظم (المادة، الشعبة، القاعة، التاريخ، الوقت).
 * 2. زر منبثق لجدولة امتحان جديد يفتح نموذج إدخال تفاعلي.
 * 3. نموذج إضافة امتحان يحتوي على حقول التحقق والتاريخ والوقت وقاعات الامتحان وملاحظات إضافية.
 * 4. توافقية كاملة مع حسابات المشرف العام (Super Admin) لاستهداف الكليات المحددة.
 * 
 * @param {Object} props - خصائص المكون.
 * @param {boolean} props.isAr - لغة الواجهة (عربي/إنجليزي).
 * @param {Array<Object>} props.exams - مصفوفة الامتحانات المجلوبة من الخادم.
 * @param {boolean} props.examsLoading - حالة تحميل جداول الامتحانات من الشبكة.
 * @param {Function} props.fetchExams - دالة إعادة جلب الامتحانات لتحديث القائمة.
 * @param {string} props.token - رمز المصادقة (JWT Token) للعمليات المحمية.
 * @param {boolean} props.isSuperAdmin - ما إذا كان المستخدم الحالي مشرفاً عاماً أم لا.
 */
export default function ExamsTab({
  isAr,
  exams,
  examsLoading,
  fetchExams,
  token,
  isSuperAdmin
}) {
  // ── الحالات المحلية للمكون (Local States) ──
  const [isAddExamOpen, setIsAddExamOpen] = useState(false);
  const [examSubmitting, setExamSubmitting] = useState(false);
  const [newExamForm, setNewExamForm] = useState({
    subjectName: '',
    subjectCode: '',
    roomName: '',
    groupName: '',
    examDate: '',
    startTime: '08:00',
    endTime: '10:00',
    notes: ''
  });

  /**
   * معالج إرسال نموذج جدولة امتحان جديد إلى الخادم الخلفي.
   * @param {React.FormEvent} e - حدث إرسال النموذج.
   */
  const handleAddExamSubmit = async (e) => {
    e.preventDefault();
    setExamSubmitting(true);
    try {
      const payload = { ...newExamForm };
      
      // إذا كان المشرف مشرفاً عاماً، نقوم بإلحاق معرف الكلية المحدد في الجلسة المحلية
      if (isSuperAdmin) {
        const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
        if (selCollegeId) payload.collegeId = parseInt(selCollegeId);
      }

      const res = await axios.post(`${API_URL}/api/exams`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        toast.success(isAr ? 'تمت إضافة الامتحان بنجاح وتنبيه الطلاب' : 'Exam scheduled & students notified');
        setIsAddExamOpen(false);
        fetchExams(); // إعادة تحميل قائمة الامتحانات
        // إعادة تعيين النموذج للحالة الافتراضية
        setNewExamForm({
          subjectName: '',
          subjectCode: '',
          roomName: '',
          groupName: '',
          examDate: '',
          startTime: '08:00',
          endTime: '10:00',
          notes: ''
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل إضافة الامتحان للجدول' : 'Failed to add exam schedule'));
    } finally {
      setExamSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── ترويسة لوحة الامتحانات ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-950 border border-slate-800/80 p-5 rounded-2xl">
        <div>
          <p className="text-sm font-black text-amber-400">📝 {isAr ? 'جدول الامتحانات النهائية' : 'Final Exam Schedule'}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {isAr ? 'عرض وجدولة وإدارة جميع اختبارات الطلاب النهائية للفصل الدراسي.' : 'View, schedule and manage student final examination timetables.'}
          </p>
        </div>
        <button
          onClick={() => setIsAddExamOpen(true)}
          className="w-full md:w-auto px-6 py-3 bg-amber-550 hover:bg-amber-400 text-slate-955 font-black rounded-xl text-xs active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <span>+</span>
          <span>{isAr ? 'إضافة امتحان جديد' : 'Add New Exam'}</span>
        </button>
      </div>

      {/* ── جسم جدول الامتحانات ── */}
      {examsLoading ? (
        <div className="flex justify-center py-20">
          <span className="h-6 w-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-slate-955 border border-dashed border-slate-800 rounded-3xl p-16 text-center text-slate-500">
          <div className="text-5xl mb-4">📝</div>
          <p className="font-black text-sm text-slate-400">{isAr ? 'لا توجد امتحانات مسجلة حتى الآن' : 'No exams scheduled yet'}</p>
          <p className="text-xs mt-2 text-slate-600">{isAr ? 'اضغط على "إضافة امتحان جديد" لإدراج جداول الامتحانات يدوياً أو استخدم الرفع الجماعي.' : 'Click "Add New Exam" to manually schedule exams or import via Excel.'}</p>
        </div>
      ) : (
        <div className="bg-slate-955 border border-slate-800/80 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" dir={isAr ? 'rtl' : 'ltr'}>
              <thead className="border-b border-slate-800 bg-slate-950/40">
                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="py-3.5 px-4 text-start">{isAr ? 'المادة الدراسية' : 'Subject'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'الشعبة المستهدفة' : 'Target Group'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'القاعات الامتحانية' : 'Exam Room(s)'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'التاريخ المقرر' : 'Exam Date'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'فترة الوقت' : 'Time Frame'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-bold">
                {exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-900/40 transition-colors">
                    {/* مسمى المادة وكودها */}
                    <td className="py-3.5 px-4 text-white">
                      <p className="text-xs font-black">{exam.subject?.name || exam.subjectName}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{exam.subject?.code || exam.subjectCode || 'N/A'}</p>
                    </td>
                    
                    {/* الشعبة المستهدفة بالامتحان */}
                    <td className="py-3.5 px-4 text-slate-300">
                      <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800 text-[10px]">
                        {exam.group?.name || exam.groupName}
                      </span>
                    </td>
                    
                    {/* قاعات الامتحان المخصصة */}
                    <td className="py-3.5 px-4 text-slate-400">
                      {exam.room?.name || exam.roomName || (isAr ? 'لم يحدد' : 'Unspecified')}
                    </td>
                    
                    {/* تاريخ الامتحان بالتنسيق المقروء */}
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[10px]">
                        {exam.examDate ? new Date(exam.examDate).toLocaleDateString(isAr ? 'ar-YE' : 'en-US') : exam.date}
                      </span>
                    </td>
                    
                    {/* وقت الامتحان */}
                    <td className="py-3.5 px-4 text-slate-400 font-mono">
                      {exam.startTime} — {exam.endTime}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── نموذج إضافة امتحان جديد (Modal) ── */}
      <AnimatePresence>
        {isAddExamOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-lg space-y-6 text-white max-h-[90vh] overflow-y-auto"
            >
              {/* ترويسة النموذج */}
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-amber-400">
                  📝 {isAr ? 'إضافة امتحان لجدول الفصل' : 'Schedule New Exam'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddExamOpen(false)}
                  className="text-slate-400 hover:text-white text-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* حقول الإدخال */}
              <form onSubmit={handleAddExamSubmit} className="space-y-4 text-xs font-bold">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: 'subjectName', label: isAr ? 'اسم المادة الدراسية' : 'Subject Name', placeholder: isAr ? 'مثال: هندسة البرمجيات 2' : 'e.g. Software Eng 2', required: true },
                    { key: 'subjectCode', label: isAr ? 'رمز المادة' : 'Subject Code', placeholder: 'e.g. SE-312', required: false },
                    { key: 'roomName', label: isAr ? 'قاعة الامتحان' : 'Exam Room', placeholder: isAr ? 'مثال: مدرج الطبري' : 'e.g. Hall A1', required: true },
                    { key: 'groupName', label: isAr ? 'الشعبة المشمولة بالامتحان' : 'Target Group', placeholder: isAr ? 'مثال: الشعبة A' : 'e.g. Group A', required: true },
                  ].map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-slate-400 block">{field.label}</label>
                      <input
                        type="text"
                        required={field.required}
                        value={newExamForm[field.key]}
                        onChange={(e) => setNewExamForm({ ...newExamForm, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400 transition-colors placeholder-slate-600"
                      />
                    </div>
                  ))}
                  
                  {/* تاريخ الامتحان */}
                  <div className="space-y-1">
                    <label className="text-slate-400 block">{isAr ? 'تاريخ الامتحان المقرر' : 'Exam Date'}</label>
                    <input
                      type="date"
                      required
                      value={newExamForm.examDate}
                      onChange={(e) => setNewExamForm({ ...newExamForm, examDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400 transition-colors cursor-pointer"
                    />
                  </div>

                  {/* وقت البدء */}
                  <div className="space-y-1">
                    <label className="text-slate-400 block">{isAr ? 'وقت بدء اللجنة' : 'Start Time'}</label>
                    <input
                      type="time"
                      required
                      value={newExamForm.startTime}
                      onChange={(e) => setNewExamForm({ ...newExamForm, startTime: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>

                  {/* وقت الانتهاء */}
                  <div className="space-y-1">
                    <label className="text-slate-400 block">{isAr ? 'وقت انتهاء اللجنة' : 'End Time'}</label>
                    <input
                      type="time"
                      required
                      value={newExamForm.endTime}
                      onChange={(e) => setNewExamForm({ ...newExamForm, endTime: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>

                  {/* ملاحظات الامتحان */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-slate-400 block">{isAr ? 'تعليمات وملاحظات اللجنة (اختياري)' : 'Exam Instructions (optional)'}</label>
                    <textarea
                      rows={2}
                      value={newExamForm.notes}
                      onChange={(e) => setNewExamForm({ ...newExamForm, notes: e.target.value })}
                      placeholder={isAr ? 'مثال: يمنع دخول الآلات الحاسبة المبرمجة أو الهواتف...' : 'e.g. No programmable calculators allowed...'}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400 transition-colors text-xs placeholder-slate-600 resize-none"
                    />
                  </div>
                </div>

                {/* أزرار الإجراء */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setIsAddExamOpen(false)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs text-white transition-colors"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={examSubmitting}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-955 rounded-xl text-xs font-black active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    {examSubmitting && <span className="h-3.5 w-3.5 border-2 border-slate-955 border-t-transparent rounded-full animate-spin shrink-0" />}
                    <span>{isAr ? 'حفظ ونشر الامتحان' : 'Save & Publish Exam'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
