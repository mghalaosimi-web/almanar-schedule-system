import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { API_URL } from '../../config';

export default function DelegateTab({ isAr, profile }) {
  const [stats, setStats] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_delegate_stats');
      return saved ? JSON.parse(saved) : { totalClassmates: 0, attendanceRate: 100, classmateStats: [] };
    } catch {
      return { totalClassmates: 0, attendanceRate: 100, classmateStats: [] };
    }
  });

  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  
  // Modals state
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrToken, setQrToken] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollSubmitting, setPollSubmitting] = useState(false);

  const fetchDelegateStats = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = localStorage.getItem('manar_token');
      const [statsRes, schedulesRes] = await Promise.all([
        axios.get(`${API_URL}/api/representative/dashboard/stats`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }),
        axios.get(`${API_URL}/api/representative/schedules`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
      ]);

      if (statsRes.data?.success) {
        setStats(statsRes.data.data);
        localStorage.setItem('cached_delegate_stats', JSON.stringify(statsRes.data.data));
      }
      if (schedulesRes.data?.success) {
        setSchedules(schedulesRes.data.data);
        if (schedulesRes.data.data.length > 0) {
          setSelectedScheduleId(schedulesRes.data.data[0].id.toString());
        }
      }
    } catch (err) {
      console.error('[DelegateTab] Error fetching stats:', err);
      toast.error(isAr ? 'فشل تحديث بيانات المندوب من السيرفر' : 'Failed to fetch representative stats');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (profile.isRepresentative) {
      fetchDelegateStats(true);
    }
  }, [profile.isRepresentative]);

  // Generate QR Token
  const handleGenerateQR = async () => {
    if (!selectedScheduleId) {
      toast.error(isAr ? 'يرجى اختيار المحاضرة أولاً' : 'Please select a lecture first');
      return;
    }
    setQrLoading(true);
    setQrToken('');
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/representative/attendance/qr-token`, {
        scheduleId: parseInt(selectedScheduleId)
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.data?.success) {
        setQrToken(res.data.token);
        toast.success(isAr ? 'تم توليد رمز الحضور بنجاح' : 'QR code generated successfully');
      } else {
        throw new Error('Token generation failed');
      }
    } catch (err) {
      console.error(err);
      toast.error(isAr ? 'فشل توليد رمز الاستجابة السريعة' : 'Failed to generate QR Code');
    } finally {
      setQrLoading(false);
    }
  };

  // Add Poll Option
  const handleAddPollOption = () => {
    if (pollOptions.length >= 4) {
      toast.error(isAr ? 'الحد الأقصى 4 خيارات' : 'Maximum 4 options allowed');
      return;
    }
    setPollOptions([...pollOptions, '']);
  };

  // Remove Poll Option
  const handleRemovePollOption = (idx) => {
    if (pollOptions.length <= 2) {
      toast.error(isAr ? 'يجب وجود خيارين على الأقل' : 'Minimum 2 options required');
      return;
    }
    setPollOptions(pollOptions.filter((_, i) => i !== idx));
  };

  // Handle Poll Option Change
  const handlePollOptionChange = (val, idx) => {
    const updated = [...pollOptions];
    updated[idx] = val;
    setPollOptions(updated);
  };

  // Submit Poll
  const handleSubmitPoll = async (e) => {
    e.preventDefault();
    if (!pollQuestion.trim()) {
      toast.error(isAr ? 'يرجى كتابة السؤال' : 'Please write the poll question');
      return;
    }
    const cleanOpts = pollOptions.map(o => o.trim()).filter(Boolean);
    if (cleanOpts.length < 2) {
      toast.error(isAr ? 'يرجى ملء خيارين على الأقل' : 'Please write at least 2 options');
      return;
    }

    setPollSubmitting(true);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/exchange/posts`, {
        title: isAr ? `استبيان: ${pollQuestion.trim()}` : `Poll: ${pollQuestion.trim()}`,
        content: pollQuestion.trim(),
        category: 'POLL',
        question: pollQuestion.trim(),
        options: cleanOpts
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.data?.success) {
        toast.success(isAr ? 'تم نشر الاستبيان بنجاح في الملتقى!' : 'Poll created successfully!');
        setIsPollModalOpen(false);
        setPollQuestion('');
        setPollOptions(['', '']);
      }
    } catch (err) {
      console.error(err);
      toast.error(isAr ? 'فشل إنشاء الاستبيان' : 'Failed to create poll');
    } finally {
      setPollSubmitting(false);
    }
  };

  if (!profile.isRepresentative) {
    return (
      <div className="bg-[#1e293b]/60 backdrop-blur-md border border-white/5 p-6 rounded-2xl text-center space-y-4">
        <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 mx-auto text-xl">
          <i className="ph ph-crown"></i>
        </div>
        <h3 className="text-sm font-bold text-white">{isAr ? 'قسم المندوب الأكاديمي' : 'Representative Panel'}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          {isAr
            ? 'هذا القسم مخصص لممثلي الدفعات والشعب (المناديب). يرجى مراجعة إدارة الكلية لتفعيل الصلاحية لحسابك.'
            : 'This section is restricted to cohort representatives. Please contact college admin to assign representative role.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Caching/Manual Sync Indicator */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-400 font-bold">{isAr ? 'بوابة المندوب النشطة' : 'Representative Cohort Control'}</span>
        <button
          onClick={() => fetchDelegateStats()}
          disabled={loading}
          className="text-amber-500 hover:text-amber-400 font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
        >
          <i className={`ph ph-arrows-clockwise ${loading ? 'animate-spin' : ''}`}></i>
          {isAr ? 'تحديث الإحصائيات' : 'Sync Stats'}
        </button>
      </div>

      {/* Cohort Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1e293b]/60 backdrop-blur-md border border-white/5 p-4 rounded-2xl flex flex-col justify-center items-center text-center">
          <span className="text-2xl text-amber-500 mb-1"><i className="ph ph-users-three"></i></span>
          <span className="text-slate-400 text-[10px] font-bold">{isAr ? 'إجمالي طلاب الشعبة' : 'Cohort Students'}</span>
          <span className="text-xl font-bold text-white mt-1">{stats.totalClassmates}</span>
        </div>
        <div className="bg-[#1e293b]/60 backdrop-blur-md border border-white/5 p-4 rounded-2xl flex flex-col justify-center items-center text-center">
          <span className="text-2xl text-emerald-500 mb-1"><i className="ph ph-chart-line-up"></i></span>
          <span className="text-slate-400 text-[10px] font-bold">{isAr ? 'نسبة حضور المحاضرات' : 'Attendance Rate'}</span>
          <span className="text-xl font-bold text-white mt-1">{stats.attendanceRate}%</span>
        </div>
      </div>

      {/* Quick Representative Actions */}
      <div className="space-y-3">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">{isAr ? 'إجراءات سريعة' : 'Quick Actions'}</h4>
        <div className="grid grid-cols-2 gap-3">
          {/* QR Attendance */}
          <button
            onClick={() => {
              setIsQRModalOpen(true);
              setQrToken('');
            }}
            className="flex flex-col items-center gap-2 bg-[#1e293b]/60 border border-white/5 hover:border-amber-500/30 p-4 rounded-2xl text-center transition-all duration-200 active:scale-95"
          >
            <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 text-lg">
              <i className="ph ph-qr-code"></i>
            </div>
            <span className="text-xs font-bold text-white">{isAr ? 'توليد كود الحضور' : 'Generate Attendance QR'}</span>
          </button>

          {/* New Poll */}
          <button
            onClick={() => setIsPollModalOpen(true)}
            className="flex flex-col items-center gap-2 bg-[#1e293b]/60 border border-white/5 hover:border-amber-500/30 p-4 rounded-2xl text-center transition-all duration-200 active:scale-95"
          >
            <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 text-lg">
              <i className="ph ph-chart-bar"></i>
            </div>
            <span className="text-xs font-bold text-white">{isAr ? 'إنشاء استبيان تصويت' : 'Create Poll'}</span>
          </button>
        </div>
      </div>

      {/* Classmate attendance tracking list */}
      <div className="bg-[#1e293b]/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 space-y-3">
        <h4 className="text-xs font-black text-white">{isAr ? 'سجل تفاعل الحضور الفردي' : 'Student Engagement'}</h4>
        
        {stats.classmateStats && stats.classmateStats.length > 0 ? (
          <div className="divide-y divide-white/5 max-h-[220px] overflow-y-auto pr-1">
            {stats.classmateStats.map((item) => (
              <div key={item.id} className="py-2 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-white block">{item.name}</span>
                  <span className="text-[10px] text-slate-400 font-bold mt-0.5">{item.idNumber}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-white">{item.attendanceRate}%</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{isAr ? `حضر: ${item.presentClasses} / ${item.totalClasses}` : `Classes: ${item.presentClasses}/${item.totalClasses}`}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-slate-500 py-3">{isAr ? 'لا توجد سجلات حضور بعد.' : 'No student records yet.'}</p>
        )}
      </div>

      {/* QR Code Modal */}
      {isQRModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-500">
                <i className="ph ph-qr-code mr-1"></i> {isAr ? 'توليد كود الحضور' : 'Attendance QR'}
              </h3>
              <button onClick={() => setIsQRModalOpen(false)} className="text-slate-400 hover:text-white transition-colors font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold block">{isAr ? 'اختر الحصة الدراسية' : 'Select Lecture slot'}</label>
                <select
                  value={selectedScheduleId}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold"
                >
                  {schedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.subject?.name} - {s.startTime}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerateQR}
                disabled={qrLoading || !selectedScheduleId}
                className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/10"
              >
                {qrLoading ? (
                  <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <i className="ph ph-lightning"></i>
                    {isAr ? 'توليد رمز التحضير' : 'Generate Token'}
                  </>
                )}
              </button>
            </div>

            {qrToken && (
              <div className="flex flex-col items-center gap-3 pt-3 border-t border-white/5">
                <div className="p-3 bg-white rounded-2xl shadow-inner">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrToken}`}
                    alt="Attendance QR Code"
                    className="w-48 h-48 object-contain"
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-bold text-center leading-relaxed">
                  {isAr
                    ? 'اطلب من زملائك في القاعة فتح شاشة تحضير الـ QR ومسح هذا الكود. الرمز ينتهي تلقائياً خلال 15 دقيقة.'
                    : 'Classmates can scan this to mark attendance. Expired in 15 minutes.'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Poll Creation Modal */}
      {isPollModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-500">
                <i className="ph ph-chart-bar mr-1"></i> {isAr ? 'إنشاء استبيان تصويت' : 'Create Poll'}
              </h3>
              <button onClick={() => setIsPollModalOpen(false)} className="text-slate-400 hover:text-white transition-colors font-bold">✕</button>
            </div>

            <form onSubmit={handleSubmitPoll} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold block">{isAr ? 'سؤال الاستبيان' : 'Poll Question'}</label>
                <input
                  type="text"
                  required
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder={isAr ? 'اكتب موضوع أو سؤال التصويت هنا...' : 'Write poll question...'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-slate-400 font-bold">{isAr ? 'خيارات التصويت' : 'Poll Options'}</label>
                  <button
                    type="button"
                    onClick={handleAddPollOption}
                    className="text-amber-500 hover:text-amber-400 font-bold text-[10px] flex items-center gap-1"
                  >
                    + {isAr ? 'إضافة خيار' : 'Add Option'}
                  </button>
                </div>

                <div className="space-y-2">
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        required
                        value={opt}
                        onChange={(e) => handlePollOptionChange(e.target.value, idx)}
                        placeholder={`${isAr ? 'خيار' : 'Option'} ${idx + 1}`}
                        className="flex-1 bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500/50"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePollOption(idx)}
                          className="text-red-400 hover:text-red-300 p-1 font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsPollModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={pollSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-955 font-black flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 transition-all"
                >
                  {pollSubmitting ? (
                    <div className="h-4 w-4 border-2 border-slate-955 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <i className="ph ph-paper-plane"></i>
                      {isAr ? 'نشر التصويت' : 'Publish Poll'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
