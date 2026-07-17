import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// ── Duration formatter ──
function sessionDuration(loginTime, logoutTime) {
  const end = logoutTime ? new Date(logoutTime) : new Date();
  const start = new Date(loginTime);
  const ms = end - start;
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m`;
  return '< 1m';
}

export default function UserDetailsModal({ isOpen, onClose, email, role, API_URL, token, isAr }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [revokingId, setRevokingId] = useState(null);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/admin/users/details?email=${encodeURIComponent(email)}&role=${role}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setData(res.data);
      } else {
        throw new Error('API failed');
      }
    } catch (err) {
      console.error('Failed to fetch user details:', err);
      toast.error(isAr ? 'فشل تحميل تفاصيل المستخدم' : 'Failed to load user details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && email && role) {
      setData(null);
      setActiveTab('profile');
      fetchDetails();
    }
  }, [isOpen, email, role]);

  const handleRevoke = async (sessionId, sessionEmail) => {
    if (!window.confirm(isAr ? `طرد الجلسة فوراً؟` : `Kick out this session immediately?`)) return;
    setRevokingId(sessionId);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/dev/sessions/revoke`,
        { sessionId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        toast.success(isAr ? `✅ تم طرد الجلسة بنجاح` : `✅ Kicked out session successfully`);
        // Refresh local details silently
        const updatedSessions = data.sessions.map(s =>
          s.id === sessionId ? { ...s, isRevoked: true, logoutTime: new Date() } : s
        );
        setData(prev => ({ ...prev, sessions: updatedSessions }));
      }
    } catch (err) {
      toast.error(isAr ? 'فشل طرد المستخدم' : 'Kick failed');
    } finally {
      setRevokingId(null);
    }
  };

  if (!isOpen) return null;

  const profile = data?.profile;
  const sessions = data?.sessions || [];
  const extra = data?.extra || {};

  // Tabs layout
  const tabs = [
    { id: 'profile', labelAr: 'الملف الشخصي', labelEn: 'Profile' },
    { id: 'sessions', labelAr: 'سجل الجلسات', labelEn: 'Sessions Log' },
    { id: 'activity', labelAr: 'سجل العمليات والنشاط', labelEn: 'Activity Timeline' },
  ];

  if (role === 'STUDENT') {
    tabs.push(
      { id: 'attendance', labelAr: 'سجل الحضور', labelEn: 'Attendance' },
      { id: 'goals', labelAr: 'الأهداف الأكاديمية', labelEn: 'Academic Goals' },
      { id: 'notifications', labelAr: 'سجل الإشعارات', labelEn: 'Notifications' }
    );
  } else if (role === 'LECTURER') {
    tabs.push(
      { id: 'schedules', labelAr: 'المحاضرات والطلبات', labelEn: 'Schedules & Requests' }
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25 }}
          className="bg-slate-950/90 border border-white/10 backdrop-blur-2xl rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative text-white z-10"
        >
          {/* Top visual gradient line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[var(--accent)] via-teal-400 to-[var(--accent)] shrink-0" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 md:right-6 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition duration-200 cursor-pointer text-sm"
          >
            ✕
          </button>

          {loading && !data ? (
            <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
              <span className="h-10 w-10 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-xs font-bold font-mono uppercase tracking-wider">
                {isAr ? 'جاري تحميل سجل التفاصيل...' : 'Loading record details...'}
              </p>
            </div>
          ) : (
            <>
              {/* Header Profile Section */}
              <div className="p-6 md:p-8 pb-4 border-b border-white/5 flex flex-col sm:flex-row items-center gap-5 shrink-0">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-[var(--accent)]/30 to-[var(--accent-glow)]/15 border border-[var(--accent-glow)]/50 flex items-center justify-center text-xl font-black text-[var(--accent)] shadow-lg shadow-[var(--accent)]/10 uppercase font-mono">
                  {profile?.name ? profile.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'U'}
                </div>

                <div className="text-center sm:text-left min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <h3 className="text-lg font-bold text-white leading-tight truncate max-w-sm">
                      {profile?.name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider border border-[var(--accent-glow)] bg-[var(--accent-dim)] text-[var(--accent)] uppercase font-mono">
                      {role}
                    </span>
                    {profile?.isRepresentative && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black border border-green-500/20 bg-green-500/10 text-green-400">
                        {isAr ? 'مندوب شعبة' : 'Representative'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-1 select-all">{email}</p>
                </div>

                <button
                  onClick={fetchDetails}
                  className="sm:ms-auto px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition duration-200"
                >
                  🔄 {isAr ? 'تحديث البيانات' : 'Refresh'}
                </button>
              </div>

              {/* Tabs Row */}
              <div className="px-6 md:px-8 border-b border-white/5 bg-black/20 overflow-x-auto flex gap-1.5 shrink-0 py-2 scrollbar-none">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-[var(--accent)] text-black font-extrabold shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {isAr ? tab.labelAr : tab.labelEn}
                  </button>
                ))}
              </div>

              {/* Modal Inner Scroll Area */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 text-xs text-slate-300">
                {/* ── PROFILE TAB ── */}
                {activeTab === 'profile' && profile && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">
                        {isAr ? 'معلومات الاتصال والأمان' : 'Contact & Security'}
                      </h4>
                      <div className="space-y-3 font-mono">
                        <div className="flex justify-between border-b border-white/5 pb-2">
                          <span className="text-slate-500">{isAr ? 'البريد الإلكتروني' : 'Email Address'}</span>
                          <span className="text-white font-semibold">{profile.email}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                          <span className="text-slate-500">{isAr ? 'الهاتف' : 'Phone'}</span>
                          <span className="text-white font-semibold">{profile.phone || 'N/A'}</span>
                        </div>
                        {role === 'STUDENT' && (
                          <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-slate-500">{isAr ? 'الرقم الجامعي' : 'Student ID'}</span>
                            <span className="text-white font-bold">{profile.idNumber}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-b border-white/5 pb-2 items-center">
                          <span className="text-slate-500">{isAr ? 'توثيق البريد' : 'Email Verification'}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            profile.isEmailVerified ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {profile.isEmailVerified ? (isAr ? 'موثق' : 'Verified') : (isAr ? 'غير موثق' : 'Pending')}
                          </span>
                        </div>
                        {role === 'STUDENT' && (
                          <div className="flex justify-between border-b border-white/5 pb-2 items-center">
                            <span className="text-slate-500">{isAr ? 'توثيق الهاتف' : 'Phone Verification'}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              profile.isPhoneVerified ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {profile.isPhoneVerified ? (isAr ? 'موثق' : 'Verified') : (isAr ? 'غير موثق' : 'Pending')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">
                        {isAr ? 'الارتباط الأكاديمي' : 'Academic Affiliation'}
                      </h4>
                      <div className="space-y-3 font-semibold">
                        <div className="flex justify-between border-b border-white/5 pb-2">
                          <span className="text-slate-500">{isAr ? 'الكلية' : 'College'}</span>
                          <span className="text-white">{profile.college?.name || 'N/A'}</span>
                        </div>
                        {role === 'STUDENT' && (
                          <>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                              <span className="text-slate-500">{isAr ? 'القسم' : 'Department'}</span>
                              <span className="text-white">{profile.major?.department?.name || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                              <span className="text-slate-500">{isAr ? 'التخصص' : 'Major'}</span>
                              <span className="text-white">{profile.major?.name || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                              <span className="text-slate-500">{isAr ? 'المستوى' : 'Level'}</span>
                              <span className="text-[var(--accent)] font-bold">{profile.level?.name || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                              <span className="text-slate-500">{isAr ? 'الشعبة' : 'Group'}</span>
                              <span className="text-[var(--accent)] font-bold">{profile.group?.name || 'N/A'}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between border-b border-white/5 pb-2">
                          <span className="text-slate-500">{isAr ? 'تاريخ التسجيل' : 'Registration Date'}</span>
                          <span className="text-slate-400 font-mono text-[10px]">{new Date(profile.createdAt || Date.now()).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── SESSIONS TAB ── */}
                {activeTab === 'sessions' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">
                      {isAr ? 'تاريخ الجلسات النشطة والسابقة' : 'Active & Past Sessions History'}
                    </h4>

                    {sessions.length === 0 ? (
                      <p className="text-slate-500 text-center py-6">{isAr ? 'لا توجد سجلات جلسات متاحة' : 'No session logs available'}</p>
                    ) : (
                      <div className="overflow-x-auto border border-white/5 rounded-2xl">
                        <table className="w-full text-left border-collapse font-sans">
                          <thead>
                            <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <th className="p-3">{isAr ? 'عنوان IP والمنصة' : 'IP & Platform'}</th>
                              <th className="p-3">{isAr ? 'وقت الدخول' : 'Login Time'}</th>
                              <th className="p-3">{isAr ? 'المدة' : 'Duration'}</th>
                              <th className="p-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                              <th className="p-3 text-center">{isAr ? 'إجراء' : 'Action'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-[11px]">
                            {sessions.map(s => {
                              const isActive = !s.logoutTime && !s.isRevoked;
                              return (
                                <tr key={s.id} className="hover:bg-white/[0.01] transition">
                                  <td className="p-3">
                                    <div className="font-mono text-slate-300">{s.ipAddress}</div>
                                    <div className="text-[9px] text-slate-500 mt-0.5 flex items-center gap-1">
                                      <span>{s.deviceOs ? (s.deviceOs.toLowerCase().includes('win') ? '💻' : s.deviceOs.toLowerCase().includes('android') ? '🤖' : '📱') : '💻'}</span>
                                      <span>{s.deviceOs || 'Web'}</span>
                                      <span>·</span>
                                      <span>{s.browser || 'Chrome'}</span>
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <div className="text-slate-300">{new Date(s.loginTime).toLocaleDateString()}</div>
                                    <div className="font-mono text-[9px] text-slate-500 mt-0.5">{new Date(s.loginTime).toLocaleTimeString()}</div>
                                  </td>
                                  <td className="p-3 font-mono text-slate-300">{sessionDuration(s.loginTime, s.logoutTime)}</td>
                                  <td className="p-3 text-center">
                                    {s.isRevoked ? (
                                      <span className="text-red-400 text-[10px] font-bold">{isAr ? 'مطرود' : 'REVOKED'}</span>
                                    ) : s.logoutTime ? (
                                      <span className="text-slate-500 text-[10px]">{isAr ? 'منتهية' : 'ENDED'}</span>
                                    ) : (
                                      <span className="text-green-400 text-[10px] font-bold animate-pulse">{isAr ? 'نشط الآن' : 'ACTIVE'}</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    {isActive && (
                                      <button
                                        onClick={() => handleRevoke(s.id, s.userEmail)}
                                        disabled={revokingId === s.id}
                                        className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 text-[10px] font-bold transition cursor-pointer"
                                      >
                                        {revokingId === s.id ? '...' : (isAr ? 'طرد' : 'Kick')}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ── ACTIVITY TIMELINE TAB ── */}
                {activeTab === 'activity' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">
                      {isAr ? 'سجل العمليات والنشاط التفصيلي' : 'Detailed User Activity Timeline'}
                    </h4>

                    {(!data?.auditLogs || data.auditLogs.length === 0) ? (
                      <p className="text-slate-500 text-center py-6">
                        {isAr ? 'لا توجد سجلات عمليات أو نشاط مسجلة لهذا الحساب' : 'No recorded activity logs found for this account'}
                      </p>
                    ) : (
                      <div className="relative border-s border-white/10 ms-4 space-y-6 py-2">
                        {data.auditLogs.map((log) => {
                          // Format details if it exists
                          let detailsStr = '';
                          if (log.details) {
                            try {
                              detailsStr = typeof log.details === 'object' 
                                ? JSON.stringify(log.details, null, 2) 
                                : String(log.details);
                            } catch (e) {
                              detailsStr = '';
                            }
                          }

                          return (
                            <div key={log.id} className="relative ps-6">
                              {/* Icon Dot */}
                              <div className="absolute -left-[9px] top-1.5 h-4.5 w-4.5 rounded-full border border-slate-950 bg-slate-900 flex items-center justify-center text-[10px] text-[var(--accent)] font-bold shadow shadow-[var(--accent)]/10">
                                🔧
                              </div>

                              <div className="p-4 bg-white/[0.015] border border-white/5 rounded-2xl space-y-1.5">
                                <div className="flex flex-wrap justify-between items-start gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-black tracking-wider text-[9px] font-mono uppercase">
                                      {log.action}
                                    </span>
                                    <span className="text-xs font-bold text-white">
                                      {log.entityType} ({log.entityId || 'N/A'})
                                    </span>
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                                    <span>🌐 {log.ipAddress}</span>
                                    <span>·</span>
                                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                                  </div>
                                </div>

                                {detailsStr && detailsStr !== '{}' && (
                                  <div className="bg-black/35 border border-white/5 rounded-lg p-2.5 mt-2 overflow-x-auto max-h-[120px] scrollbar-thin">
                                    <code className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap leading-normal block">
                                      {detailsStr}
                                    </code>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── ATTENDANCE TAB (Student) ── */}
                {activeTab === 'attendance' && role === 'STUDENT' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">
                      {isAr ? 'سجل حضور وغياب الطالب' : 'Student Attendance History'}
                    </h4>

                    {(!extra.attendances || extra.attendances.length === 0) ? (
                      <p className="text-slate-500 text-center py-6">{isAr ? 'لا توجد سجلات حضور مسجلة لهذا الطالب' : 'No attendance logs registered for this student'}</p>
                    ) : (
                      <div className="overflow-x-auto border border-white/5 rounded-2xl">
                        <table className="w-full text-left border-collapse font-sans">
                          <thead>
                            <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <th className="p-3">{isAr ? 'المادة المحاضرة' : 'Subject / Lecture'}</th>
                              <th className="p-3">{isAr ? 'القاعة' : 'Room'}</th>
                              <th className="p-3">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
                              <th className="p-3 text-center">{isAr ? 'حالة الحضور' : 'Status'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-[11px]">
                            {extra.attendances.map(a => {
                              const isPresent = a.status === 'PRESENT';
                              const isLate = a.status === 'LATE';
                              return (
                                <tr key={a.id} className="hover:bg-white/[0.01] transition">
                                  <td className="p-3">
                                    <div className="font-bold text-white">{a.schedule?.subject?.name || 'N/A'}</div>
                                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">{a.schedule?.subject?.code || ''}</div>
                                  </td>
                                  <td className="p-3 text-slate-300 font-semibold">{a.schedule?.room?.name || 'N/A'}</td>
                                  <td className="p-3">
                                    <div className="text-slate-300">{new Date(a.date).toLocaleDateString()}</div>
                                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">{a.schedule?.startTime} - {a.schedule?.endTime}</div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                      isPresent
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : isLate
                                        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                        : 'bg-red-500/10 text-red-450 border border-red-500/20'
                                    }`}>
                                      {a.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ── GOALS TAB (Student) ── */}
                {activeTab === 'goals' && role === 'STUDENT' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">
                      {isAr ? 'الأهداف الأكاديمية والمهام' : 'Academic Goals Progress'}
                    </h4>

                    {(!extra.goals || extra.goals.length === 0) ? (
                      <p className="text-slate-500 text-center py-6">{isAr ? 'لم ينجز الطالب أي أهداف أكاديمية بعد' : 'No academic goals completed by the student yet'}</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {extra.goals.map(g => (
                          <div key={g.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col justify-between gap-3">
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <h5 className="font-bold text-white text-xs">{g.academicGoal?.title}</h5>
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-black shrink-0">
                                  {g.status}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{g.academicGoal?.description || (isAr ? 'لا يوجد وصف' : 'No description')}</p>
                            </div>

                            <div className="flex justify-between items-center text-[10px] border-t border-white/5 pt-2 font-mono text-slate-500">
                              <span>📚 {g.academicGoal?.subject?.name}</span>
                              <span>✅ {new Date(g.completedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── NOTIFICATIONS TAB (Student) ── */}
                {activeTab === 'notifications' && role === 'STUDENT' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">
                      {isAr ? 'الإشعارات المرسلة والمستلمة' : 'System Notifications Log'}
                    </h4>

                    {(!extra.notifications || extra.notifications.length === 0) ? (
                      <p className="text-slate-500 text-center py-6">{isAr ? 'لا توجد إشعارات مرسلة لهذا الطالب' : 'No notifications sent to this student'}</p>
                    ) : (
                      <div className="space-y-3">
                        {extra.notifications.map(n => (
                          <div key={n.id} className="p-4 bg-white/[0.015] border border-white/5 rounded-2xl flex justify-between gap-4">
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <h5 className="font-bold text-white text-xs truncate">{n.title || (isAr ? 'إشعار النظام' : 'System Notification')}</h5>
                              <p className="text-[11px] text-slate-300 leading-relaxed">{n.message}</p>
                              <div className="flex flex-wrap gap-2 items-center text-[9px] text-slate-500 font-mono">
                                <span>🕒 {new Date(n.sentTime).toLocaleString()}</span>
                                {n.platform && <span>· 💻 {n.platform}</span>}
                                {n.broadcastId && <span className="text-sky-400">· 📢 Broadcast</span>}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 shrink-0 font-mono text-[9px]">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                                n.status === 'SENT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {n.status}
                              </span>
                              <div className="flex flex-col gap-0.5 items-end text-slate-500">
                                <span>📥 {n.deliveredAt ? (isAr ? 'تم الاستلام' : 'Delivered') : (isAr ? 'معلق' : 'Pending')}</span>
                                <span>📖 {n.readAt ? (isAr ? 'تمت القراءة' : 'Read') : (isAr ? 'غير مقروء' : 'Unread')}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── SCHEDULES TAB (Lecturer) ── */}
                {activeTab === 'schedules' && role === 'LECTURER' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">
                        {isAr ? 'جدول المحاضرات الأسبوعية' : 'Weekly Assigned Lectures'}
                      </h4>

                      {(!extra.schedules || extra.schedules.length === 0) ? (
                        <p className="text-slate-500 text-center py-6">{isAr ? 'لا توجد محاضرات مسندة لهذا المحاضر' : 'No schedules assigned to this lecturer'}</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {extra.schedules.map(s => (
                            <div key={s.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                              <div className="flex justify-between items-start gap-2">
                                <h5 className="font-bold text-white text-xs">{s.subject?.name}</h5>
                                <span className="px-2 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)] text-[9px] font-black uppercase tracking-wider border border-[var(--accent-glow)] shrink-0">
                                  {s.dayOfWeek}
                                </span>
                              </div>
                              <div className="space-y-1 text-[11px] text-slate-400">
                                <div className="flex justify-between">
                                  <span>{isAr ? 'الوقت' : 'Time'}</span>
                                  <span className="font-mono">{s.startTime} - {s.endTime}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>{isAr ? 'القاعة' : 'Room'}</span>
                                  <span className="font-semibold text-white">{s.room?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>{isAr ? 'الشعبة' : 'Group'}</span>
                                  <span className="font-semibold text-[var(--accent)]">{s.group?.name}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">
                        {isAr ? 'طلبات تعديل المواعيد' : 'Reschedule & Cancel Requests'}
                      </h4>

                      {(!extra.requests || extra.requests.length === 0) ? (
                        <p className="text-slate-500 text-center py-6">{isAr ? 'لا توجد طلبات تعديل سابقة' : 'No previous reschedule requests found'}</p>
                      ) : (
                        <div className="space-y-3">
                          {extra.requests.map(r => (
                            <div key={r.id} className="p-4 bg-white/[0.015] border border-white/5 rounded-2xl flex justify-between gap-4">
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex gap-2 items-center">
                                  <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[9px] font-bold">{r.requestType}</span>
                                  <h5 className="font-bold text-white text-xs truncate">{r.schedule?.subject?.name}</h5>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  {isAr ? 'المقترح:' : 'Proposed:'} <span className="font-mono text-white text-xs">{r.newDayOfWeek} {r.newStartTime}-{r.newEndTime} ({r.newRoom?.name || 'N/A'})</span>
                                </p>
                                {r.reason && <p className="text-[11px] text-slate-500 leading-relaxed">💡 {r.reason}</p>}
                                {r.adminNotes && <p className="text-[11px] text-teal-400 leading-relaxed">💬 Admin: {r.adminNotes}</p>}
                              </div>

                              <div className="flex flex-col items-end justify-between shrink-0">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                                  r.status === 'APPROVED'
                                    ? 'bg-green-500/10 text-green-450 border-green-500/20'
                                    : r.status === 'REJECTED'
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                }`}>
                                  {r.status}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">{new Date(r.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Modal Footer */}
          <div className="p-4 md:p-6 border-t border-white/5 bg-black/40 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-slate-400 rounded-xl text-xs font-black text-slate-300 hover:text-white transition duration-200 cursor-pointer"
            >
              {isAr ? 'إغلاق النافذة' : 'Close Details'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
