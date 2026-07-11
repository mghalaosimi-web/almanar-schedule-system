/**
 * @file ApprovalsTab.jsx
 * @description تبويب الموافقات (Approvals) في لوحة تحكم المشرف. يتيح التحقق من الهويات الجامعية للطلاب وتفعيل حساباتهم المعلقة.
 * @author أنتيجرافيتي (Antigravity)
 */

import React from 'react';
import { motion } from 'framer-motion';

/**
 * مكون التحقق وتوثيق حسابات الطلاب الجدد.
 * 
 * الميزات:
 * 1. عرض قائمة الطلاب المعلقين (Pending Registrations) في شريط جانبي تفاعلي.
 * 2. تفصيل بيانات الطالب المحدد (الاسم، البريد، الهاتف، التخصص، المستوى، الشعبة).
 * 3. عرض صورة الهوية الشخصية المرفوعة للتحقق البصري من المصداقية.
 * 4. أزرار قرار التوثيق (Approve) أو الرفض والحذف نهائياً (Reject).
 * 
 * @param {Object} props - خصائص المكون.
 * @param {boolean} props.isAr - لغة المكون (عربي/إنجليزي).
 * @param {boolean} props.loading - حالة التحميل العامة لقائمة الطلاب المعلقين.
 * @param {Array<Object>} props.unverifiedStudents - مصفوفة الطلاب غير الموثقين.
 * @param {Object} props.selectedStudent - كائن الطالب المختار حالياً للعرض والمراجعة.
 * @param {Function} props.setSelectedStudent - دالة تغيير الطالب المختار.
 * @param {number|string} props.approvingId - معرف الطالب الجاري توثيقه لمنع الضغط المزدوج وإظهار مؤشر الانتظار.
 * @param {number|string} props.rejectingId - معرف الطالب الجاري رفضه وتطهير حسابه.
 * @param {Function} props.handleApproveStudent - دالة استدعاء التوثيق وتفعيل الحساب.
 * @param {Function} props.handleRejectStudent - دالة استدعاء الرفض وحذف الحساب.
 */
export default function ApprovalsTab({
  isAr,
  loading,
  unverifiedStudents,
  selectedStudent,
  setSelectedStudent,
  approvingId,
  rejectingId,
  handleApproveStudent,
  handleRejectStudent
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
      {/* ── القائمة الجانبية للطلاب المعلقين ── */}
      <div className="md:col-span-5 bg-slate-950/40 border border-slate-800 rounded-2xl p-5 shadow-lg h-[650px] flex flex-col">
        <h3 className="text-sm font-black text-white mb-4">
          {isAr ? 'طلبات التسجيل المعلقة' : 'Pending Approvals'}
        </h3>
        
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500 font-bold">{isAr ? 'جاري تحميل قائمة الطلاب...' : 'Loading student directory...'}</span>
          </div>
        ) : unverifiedStudents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <span className="text-3xl block mb-2">🎉</span>
            <p className="text-xs font-black text-slate-400">{isAr ? 'جميع الطلاب موثقون ومفعلون!' : 'All students verified!'}</p>
            <p className="text-[10px] text-slate-500 mt-1">{isAr ? 'لا توجد طلبات تسجيل معلقة حالياً في الكلية.' : 'No pending student accounts are awaiting verification.'}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {unverifiedStudents.map((student) => {
              const isSelected = selectedStudent?.id === student.id;
              return (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(student)}
                  className={`w-full text-start p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-[var(--accent-dim)] border-[var(--accent)] shadow-md'
                      : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900/60 hover:border-slate-800'
                  }`}
                >
                  <div className="font-bold text-xs text-white truncate">{student.name}</div>
                  <div className="text-[10px] text-slate-400 truncate mt-1">{student.email}</div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[9px] font-black text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 uppercase">
                      {student.group?.name || (isAr ? 'بدون شعبة' : 'No Group')}
                    </span>
                    <span className="text-[8px] font-bold text-slate-500">
                      {new Date(student.createdAt).toLocaleDateString(isAr ? 'ar' : 'en')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── لوحة المعاينة والتفاصيل واتخاذ القرار ── */}
      <div className="md:col-span-7 bg-slate-955 border border-slate-800 rounded-2xl p-6 shadow-xl min-h-[500px]">
        {selectedStudent ? (
          <div className="space-y-6">
            <div className="flex justify-between items-start border-b border-slate-800/80 pb-5">
              <div>
                <h3 className="text-base font-black text-white">{selectedStudent.name}</h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">{selectedStudent.email}</p>
              </div>
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black rounded-lg uppercase tracking-wider">
                ● {isAr ? 'حساب معلق' : 'PENDING'}
              </span>
            </div>

            {/* تفاصيل البطاقة الأكاديمية */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: isAr ? 'رقم الهوية الجامعية' : 'University ID', val: selectedStudent.idNumber },
                { label: isAr ? 'الهاتف' : 'Phone Number', val: selectedStudent.phone },
                { label: isAr ? 'التخصص الدراسي' : 'Specialty Major', val: selectedStudent.major?.name || (isAr ? 'غير محدد' : 'N/A') },
                { label: isAr ? 'المستوى' : 'Academic Level', val: selectedStudent.level?.name || (isAr ? 'غير محدد' : 'N/A') },
                { label: isAr ? 'الشعبة' : 'Class Group', val: selectedStudent.group?.name || (isAr ? 'غير محدد' : 'N/A') },
                { label: isAr ? 'تاريخ التسجيل' : 'Registered Date', val: new Date(selectedStudent.createdAt).toLocaleDateString(isAr ? 'ar' : 'en') }
              ].map((item, i) => (
                <div key={i} className="bg-slate-950/50 border border-slate-850 p-3 rounded-xl">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">{item.label}</span>
                  <span className="block text-xs font-black text-white mt-1.5">{item.val}</span>
                </div>
              ))}
            </div>

            {/* معاينة صورة الهوية المرفوعة للتحقق الجغرافي */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                📷 {isAr ? 'صورة الهوية الجامعية / الشخصية للتحقق' : 'Uploaded ID Credential Photo'}
              </h4>
              {selectedStudent.idPhotoUrl ? (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[300px]">
                  <img
                    src={selectedStudent.idPhotoUrl}
                    alt="Student Identity"
                    className="max-w-full max-h-[300px] object-contain"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-800 rounded-xl p-8 text-center bg-slate-955">
                  <span className="text-2xl block mb-1">🖼️</span>
                  <p className="text-xs font-bold text-slate-500">{isAr ? 'لم يرفع الطالب صورة للتحقق.' : 'No credential photo uploaded by the student.'}</p>
                </div>
              )}
            </div>

            {/* أزرار الإجراء الإداري */}
            <div className="flex gap-4 pt-4 border-t border-slate-800/80">
              <button
                disabled={rejectingId === selectedStudent.id || approvingId === selectedStudent.id}
                onClick={() => {
                  if (window.confirm(isAr ? 'هل أنت متأكد من رفض وحذف طلب هذا الطالب نهائياً؟' : 'Are you sure you want to reject and delete this registration?')) {
                    handleRejectStudent(selectedStudent.id);
                  }
                }}
                className="flex-1 py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-black text-xs hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                {rejectingId === selectedStudent.id ? (
                  <span className="h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin mx-auto" />
                ) : (
                  isAr ? 'رفض وحذف الحساب' : 'Reject & Purge Account'
                )}
              </button>

              <button
                disabled={approvingId === selectedStudent.id || rejectingId === selectedStudent.id}
                onClick={() => handleApproveStudent(selectedStudent.id)}
                className="flex-1 py-3.5 rounded-xl bg-[var(--accent)] text-slate-950 font-black text-xs hover:shadow-[0_0_20px_var(--accent-glow)] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {approvingId === selectedStudent.id ? (
                  <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isAr ? 'توثيق وتفعيل الحساب' : 'Approve & Activate Account'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <span className="text-4xl block mb-3">👈</span>
            <p className="text-xs font-black text-slate-400">
              {isAr ? 'الرجاء اختيار طالب من القائمة الجانبية للمراجعة' : 'Select a student profile from the sidebar to review'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              {isAr ? 'سيتم عرض بيانات التحقق والتحصيل هنا لاتخاذ القرار.' : 'Identity credentials and action buttons will display here.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
