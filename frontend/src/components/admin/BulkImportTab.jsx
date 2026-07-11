/**
 * @file BulkImportTab.jsx
 * @description تبويب استيراد البيانات الجماعي (Bulk Import) في لوحة تحكم المشرف. يتيح رفع ملفات Excel لتسجيل الطلاب أو الحصص أو الامتحانات جماعياً.
 * @author أنتيجرافيتي (Antigravity)
 */

import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { API_URL } from '../../config';

/**
 * مكون واجهة رفع وقراءة جداول Excel لاستيراد الطلاب والجداول والاختبارات.
 * 
 * الميزات:
 * 1. التبديل بين ثلاثة أنواع استيراد (الطلاب، الحصص الدراسية، جدول الامتحانات).
 * 2. منطقة تفاعلية للسحب والإفلات (Drag & Drop File Area) مع دعم استكشاف الأخطاء.
 * 3. تشفير وقراءة الملف بصيغة Base64 قبل الإرسال للخادم.
 * 4. تجميع الاستجابة وعرض لوحة النتائج (المنشئين بنجاح، المتخطين، تقرير الأخطاء بالتفصيل ورقم الصف المسبب).
 * 
 * @param {Object} props - خصائص المكون.
 * @param {boolean} props.isAr - لغة واجهة المكون.
 * @param {string} props.token - رمز التوثيق (JWT Token) للمصادقة مع الخادم.
 * @param {boolean} props.isSuperAdmin - هل المشرف الحالي هو مشرف عام (Super Admin).
 */
export default function BulkImportTab({ isAr, token, isSuperAdmin }) {
  const [uploadType, setUploadType] = useState('students'); // 'students' | 'schedules' | 'exams'
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { created, skipped, errors: [{ row, reason }] }

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    validateAndSetFile(droppedFile);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (selectedFile) => {
    if (!selectedFile) return;
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      toast.error(isAr ? 'نوع الملف غير مدعوم. يرجى رفع ملف Excel فقط (.xlsx, .xls)' : 'Unsupported file format. Please upload Excel sheets.');
      return;
    }
    setFile(selectedFile);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        
        let endpoint = '/api/admin/upload-students';
        if (uploadType === 'schedules') endpoint = '/api/admin/upload-schedules';
        else if (uploadType === 'exams') endpoint = '/api/admin/upload-exams';

        const payload = { fileBase64: base64 };
        
        // إذا كان مشرف عام، نمرر معرف الكلية المحددة المخزنة محلياً
        if (isSuperAdmin) {
          const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
          if (selCollegeId) {
            payload.collegeId = parseInt(selCollegeId);
          }
        }

        const res = await axios.post(`${API_URL}${endpoint}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.data?.success) {
          toast.success(isAr ? 'اكتملت عملية الاستيراد الجماعي بنجاح!' : 'Bulk data import completed successfully!');
          setResult(res.data.data);
          setFile(null);
        }
      } catch (err) {
        console.error(err);
        const errMsg = err.response?.data?.error || (isAr ? 'فشل معالجة ورفع الملف' : 'Failed to process file upload.');
        toast.error(errMsg);
      } finally {
        setLoading(false);
      }
    };
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-start">
      {/* ── لوحة الاختيار والنوع ── */}
      <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 shadow-md">
        <h3 className="text-sm font-black text-white mb-4">
          {isAr ? 'نوع البيانات المراد استيرادها جماعياً' : 'Select Import Data Classification'}
        </h3>
        
        <div className="grid grid-cols-3 gap-4">
          {[
            { id: 'students', label: isAr ? '🎓 الطلاب الجدد' : 'Students List', desc: isAr ? 'الاسم، البريد، رقم الهوية، الهاتف، التخصص.' : 'New registrants & profiles.' },
            { id: 'schedules', label: isAr ? '📅 الجداول الأسبوعية' : 'Lecture Schedules', desc: isAr ? 'اسم المادة، رمز المادة، القاعة، الشعبة، الموعد.' : 'Timetable scheduling cells.' },
            { id: 'exams', label: isAr ? '📝 جداول الامتحانات' : 'Exam Schedule', desc: isAr ? 'اسم المادة، القاعة، الشعبة، تاريخ وفترة الاختبار.' : 'Final assessment calendar.' }
          ].map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => {
                setUploadType(type.id);
                setFile(null);
                setResult(null);
              }}
              className={`p-4 rounded-xl border text-start transition-all ${
                uploadType === type.id
                  ? 'bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-slate-900 border-slate-850 text-slate-400 hover:bg-slate-850'
              }`}
            >
              <span className="block text-xs font-black">{type.label}</span>
              <span className="block text-[9px] text-slate-500 font-bold mt-1.5 leading-relaxed">{type.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── منطقة السحب والإفلات المخصصة ── */}
      <div className="bg-slate-955 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
            dragging
              ? 'border-[var(--accent)] bg-[var(--accent-dim)]/10'
              : file
              ? 'border-cyan-500/40 bg-cyan-500/5'
              : 'border-slate-800 bg-slate-950/20 hover:border-slate-700'
          }`}
        >
          <input
            type="file"
            id="excel-file-input"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="hidden"
          />

          <span className="text-4xl block mb-3">{file ? '📝' : '📥'}</span>
          
          {file ? (
            <div className="space-y-2">
              <p className="text-xs font-black text-white">{file.name}</p>
              <p className="text-[10px] text-slate-500">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-[10px] text-red-400 font-black underline underline-offset-4 hover:text-red-300"
              >
                {isAr ? 'إزالة الملف المختار' : 'Remove Selected File'}
              </button>
            </div>
          ) : (
            <label htmlFor="excel-file-input" className="cursor-pointer space-y-1 block">
              <p className="text-xs font-black text-slate-200">
                {isAr ? 'اسحب ملف الـ Excel المنسق هنا وأفلته' : 'Drag & drop your formatted Excel file here'}
              </p>
              <p className="text-[10px] text-slate-500 font-bold">
                {isAr ? 'أو انقر لتصفح ملفات جهازك (.xlsx, .xls)' : 'or click to browse your local computer'}
              </p>
            </label>
          )}
        </div>

        {/* زر التثبيت ومعالجة الاستيراد */}
        {file && (
          <button
            type="button"
            disabled={loading}
            onClick={handleUpload}
            className="w-full py-3.5 rounded-xl bg-cyan-500 text-slate-950 font-black text-xs hover:shadow-[0_0_20px_var(--accent-glow)] transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{isAr ? 'بدء معالجة واستيراد البيانات' : 'Initialize Bulk Import Processing'}</span>
                <span>⚡</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* ── لوحة عرض نتائج الرفع وتفاصيل الأخطاء ── */}
      {result && (
        <div className="bg-slate-955 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="border-b border-slate-800/80 pb-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              📊 {isAr ? 'تقرير نتائج الاستيراد الجماعي للبيانات' : 'Bulk Upload Report Summary'}
            </h3>
          </div>

          {/* لوحة الأرقام السريعة */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl text-center">
              <span className="block text-[9px] font-bold text-slate-500 uppercase">{isAr ? 'السجلات المضافة' : 'Successfully Created'}</span>
              <span className="block text-2xl font-black text-emerald-400 mt-1">{result.created}</span>
            </div>
            
            <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl text-center">
              <span className="block text-[9px] font-bold text-slate-500 uppercase">{isAr ? 'السجلات المتخطاة' : 'Skipped / Duplicates'}</span>
              <span className="block text-2xl font-black text-amber-400 mt-1">{result.skipped}</span>
            </div>

            <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl text-center col-span-2 md:col-span-1">
              <span className="block text-[9px] font-bold text-slate-500 uppercase">{isAr ? 'الأخطاء المكتشفة' : 'Failed Rows'}</span>
              <span className="block text-2xl font-black text-red-400 mt-1">{result.errors.length}</span>
            </div>
          </div>

          {/* قائمة تفاصيل الأخطاء وسطر الصف المسبب */}
          {result.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                ⚠️ {isAr ? 'تفاصيل أخطاء الأسطر المعلقة:' : 'Detailed Rows Error Logs:'}
              </h4>
              <div className="border border-slate-850 bg-slate-950/40 rounded-xl max-h-48 overflow-y-auto p-4 space-y-2.5">
                {result.errors.map((err, idx) => (
                  <div key={idx} className="text-[11px] text-slate-400 border-b border-slate-900 last:border-0 pb-2 last:pb-0 flex gap-2">
                    <span className="font-mono text-red-400 font-bold bg-red-950/30 border border-red-900/25 px-1.5 py-0.5 rounded shrink-0">
                      {isAr ? `صف ${err.row}` : `Row ${err.row}`}
                    </span>
                    <span className="leading-relaxed">{err.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
