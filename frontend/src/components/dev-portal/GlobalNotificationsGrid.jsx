import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// ── Read Receipt Badge ────────────────────────────────────────────────────────
function ReceiptBadge({ deliveredAt, readAt, isAr }) {
  if (readAt) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
          <span>👀 ✅</span> {isAr ? 'قُرئ' : 'Read'}
        </span>
        <span className="text-[8px] text-slate-500 font-mono">
          {new Date(readAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    );
  }
  if (deliveredAt) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-sky-400 text-[10px] font-bold flex items-center gap-1">
          <span>✅</span> {isAr ? 'وصل' : 'Delivered'}
        </span>
        <span className="text-[8px] text-slate-500 font-mono">
          {new Date(deliveredAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    );
  }
  return (
    <span className="text-slate-600 text-[10px] font-bold flex items-center gap-1">
      <span>📨</span> {isAr ? 'مرسل' : 'Sent'}
    </span>
  );
}

// ── Platform Badge ─────────────────────────────────────────────────────────────
function PlatformBadge({ platform }) {
  const map = {
    Android: { icon: '🤖', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
    iOS:     { icon: '🍎', color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' },
    Web:     { icon: '🌐', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'   },
  };
  const p = map[platform] || { icon: '📱', color: 'text-slate-500 bg-slate-800 border-slate-700' };
  if (!platform) return <span className="text-slate-700 text-[9px]">—</span>;
  return (
    <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${p.color}`}>
      {p.icon} {platform}
    </span>
  );
}

// ── Mini Stats Bar ────────────────────────────────────────────────────────────
function StatsBar({ logs, isAr }) {
  const total     = logs.length;
  const read      = logs.filter(l => l.readAt).length;
  const delivered = logs.filter(l => l.deliveredAt && !l.readAt).length;
  const sent      = logs.filter(l => !l.deliveredAt && !l.readAt).length;
  const readRate  = total > 0 ? Math.round((read / total) * 100) : 0;

  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {[
        { label: isAr ? 'المرسلة' : 'Sent',      value: sent,      color: 'text-slate-400', bg: 'bg-slate-800/60' },
        { label: isAr ? 'المستلمة' : 'Delivered', value: delivered, color: 'text-sky-400',   bg: 'bg-sky-500/10 border border-sky-500/20' },
        { label: isAr ? 'المقروءة' : 'Read',      value: read,      color: 'text-emerald-400', bg: 'bg-emerald-500/10 border border-emerald-500/20' },
        { label: isAr ? 'معدل القراءة' : 'Read Rate', value: `${readRate}%`, color: readRate > 60 ? 'text-emerald-400' : readRate > 30 ? 'text-amber-400' : 'text-red-400', bg: 'bg-slate-800/60' },
      ].map((s, i) => (
        <div key={i} className={`${s.bg} rounded-xl p-3 text-center`}>
          <span className={`text-sm font-black font-mono ${s.color}`}>{s.value}</span>
          <span className="block text-[9px] text-slate-500 mt-0.5">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GlobalNotificationsGrid({ API_URL, token, isAr }) {
  const [logs,       setLogs]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const limit = 12;

  // Dispatch
  const [targetType, setTargetType] = useState('ALL');
  const [targetId,   setTargetId]   = useState('');
  const [title,      setTitle]      = useState('');
  const [message,    setMessage]    = useState('');
  const [sending,    setSending]    = useState(false);

  // Filter
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Dropdowns
  const [students,     setStudents]     = useState([]);
  const [groups,       setGroups]       = useState([]);
  const [colleges,     setColleges]     = useState([]);
  const [universities, setUniversities] = useState([]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      const res = await axios.get(
        `${API_URL}/api/admin/dev/notifications?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setLogs(res.data.data);
        setTotal(res.data.total);
      }
    } catch {
      toast.error(isAr ? 'فشل تحميل سجل الإشعارات' : 'Failed to fetch notification logs');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, API_URL, token]);

  const fetchDropdowns = async () => {
    try {
      const [cfgRes, grpRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/dev/tenant-configs`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/admin/groups`,             { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (cfgRes.data?.success) {
        setColleges(cfgRes.data.data.colleges || []);
        setUniversities(cfgRes.data.data.universities || []);
      }
      if (grpRes.data?.success) setGroups(grpRes.data.data || []);
    } catch {}
  };

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchDropdowns(); }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error(isAr ? 'يرجى كتابة نص الرسالة' : 'Message body is required');
      return;
    }
    setSending(true);
    try {
      const body = {
        title:       title.trim() || undefined,
        message:     message.trim(),
        studentId:   targetType === 'STUDENT'    ? parseInt(targetId)  : undefined,
        groupId:     targetType === 'GROUP'      ? parseInt(targetId)  : undefined,
        collegeId:   targetType === 'COLLEGE'    ? parseInt(targetId)  : undefined,
        universityId: targetType === 'UNIVERSITY' ? parseInt(targetId) : undefined,
      };
      const res = await axios.post(`${API_URL}/api/admin/dev/notifications`, body, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? '✅ تم بث الإشعار بنجاح!' : '✅ Global alert dispatched!');
        setMessage('');
        setTitle('');
        setTargetId('');
        setPage(1);
        fetchLogs();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل الإرسال' : 'Dispatch failed'));
    } finally {
      setSending(false);
    }
  };

  const exportCSV = () => {
    if (!logs.length) return;
    const rows = logs.map(l => [
      l.id,
      l.title || '',
      `"${l.message.replace(/"/g, '""')}"`,
      l.group?.name || '',
      l.student?.name || '',
      l.status,
      l.platform || '',
      l.deliveredAt ? new Date(l.deliveredAt).toISOString() : '',
      l.readAt ? new Date(l.readAt).toISOString() : '',
      new Date(l.sentTime).toISOString(),
    ]);
    const csv = [
      ['ID', 'Title', 'Message', 'Group', 'Student', 'Status', 'Platform', 'DeliveredAt', 'ReadAt', 'SentTime'],
      ...rows
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `notifications_${Date.now()}.csv`; a.click();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

      {/* ── Left: Dispatch Form ── */}
      <div className="xl:col-span-1 bg-slate-900/60 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-6 shadow-2xl h-fit">
        <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
          <span className="text-purple-400">📢</span>
          {isAr ? 'بث تنبيه إداري فوري' : 'Dispatch Global Alert'}
        </h3>
        <p className="text-[11px] text-slate-500 mb-5">
          {isAr ? 'إرسال إشعار Push + SSE لجميع الطلاب أو فئات مستهدفة.' : 'Send real-time Push + SSE broadcast across all tenants.'}
        </p>

        <form onSubmit={handleSend} className="space-y-3">
          {/* Target Type */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
              {isAr ? 'نوع الاستهداف' : 'Target Type'}
            </label>
            <select
              value={targetType}
              onChange={e => { setTargetType(e.target.value); setTargetId(''); }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
            >
              <option value="ALL">{isAr ? '🌐 الجميع (عبر المستأجرين)' : '🌐 All Students (Cross-tenant)'}</option>
              <option value="UNIVERSITY">{isAr ? '🏛️ جامعة محددة' : '🏛️ Specific University'}</option>
              <option value="COLLEGE">{isAr ? '🏫 كلية محددة' : '🏫 Specific College'}</option>
              <option value="GROUP">{isAr ? '👥 مجموعة دراسية' : '👥 Student Group'}</option>
              <option value="STUDENT">{isAr ? '👤 طالب معين' : '👤 Individual Student'}</option>
            </select>
          </div>

          {/* Target selection */}
          {targetType !== 'ALL' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                {isAr ? 'حدد الهدف' : 'Select Target'}
              </label>
              <select
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                <option value="">{isAr ? '-- اختر من القائمة --' : '-- Choose --'}</option>
                {targetType === 'UNIVERSITY' && universities.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
                {targetType === 'COLLEGE' && colleges.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.university?.name})</option>
                ))}
                {targetType === 'GROUP' && groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.college?.name})</option>
                ))}
                {targetType === 'STUDENT' && students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
              {isAr ? 'عنوان الإشعار (اختياري)' : 'Title (optional)'}
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={isAr ? 'مثال: تنبيه عاجل بتغيير الجدول' : 'e.g. Schedule Change Alert'}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
            />
          </div>

          {/* Message body */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
              {isAr ? 'نص الرسالة' : 'Message Body'}
            </label>
            <textarea
              rows="4"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={isAr ? 'اكتب تفاصيل التنبيه الإداري هنا...' : 'Enter the broadcast message...'}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50 resize-none"
            />
            <div className="text-[9px] text-slate-600 mt-1 text-right font-mono">{message.length}/500</div>
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-black rounded-xl text-xs transition duration-200 shadow-lg shadow-purple-600/20 flex justify-center items-center gap-2"
          >
            {sending
              ? <span className="animate-pulse">{isAr ? '⚡ جاري البث...' : '⚡ Broadcasting...'}</span>
              : <><span>⚡</span><span>{isAr ? 'بث الإشعار الفوري الآن' : 'Dispatch Now'}</span></>
            }
          </button>
        </form>
      </div>

      {/* ── Right: Notification Logs ── */}
      <div className="xl:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-start gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-purple-400">📬</span>
              {isAr ? 'سجل الإشعارات مع إيصالات القراءة' : 'Notification Log + Read Receipts'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isAr ? 'تتبع حالة التسليم والقراءة لكل إشعار مرسل.' : 'Track delivery status and read receipts per notification.'}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={fetchLogs}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition"
            >🔄 {isAr ? 'تحديث' : 'Refresh'}</button>
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-lg text-[10px] font-bold transition"
            >📥 CSV</button>
          </div>
        </div>

        {/* Stats bar */}
        <StatsBar logs={logs} isAr={isAr} />

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {['ALL', 'SENT', 'FAILED'].map(f => (
            <button
              key={f}
              onClick={() => { setStatusFilter(f); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition border ${
                statusFilter === f
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                  : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-white'
              }`}
            >
              {f === 'ALL' ? (isAr ? 'الكل' : 'All') : f}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-slate-600 font-mono self-center">{total} {isAr ? 'إشعار' : 'records'}</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="pb-3 text-left">{isAr ? 'العنوان / الرسالة' : 'Title / Message'}</th>
                <th className="pb-3 text-left">{isAr ? 'المستلم' : 'Recipient'}</th>
                <th className="pb-3 text-left">{isAr ? 'المنصة' : 'Platform'}</th>
                <th className="pb-3 text-left">{isAr ? 'وقت الإرسال' : 'Sent'}</th>
                <th className="pb-3 text-center">{isAr ? 'إيصال القراءة' : 'Receipt'}</th>
                <th className="pb-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center py-10 text-slate-500 text-xs">
                  <span className="animate-pulse">{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-10 text-slate-600 text-xs">
                  {isAr ? 'لا توجد إشعارات مرسلة بعد' : 'No notifications yet'}
                </td></tr>
              ) : logs.map((log, idx) => (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="border-b border-slate-800/40 hover:bg-slate-800/10 transition duration-150"
                >
                  <td className="py-3.5 max-w-[180px]">
                    {log.title && (
                      <div className="text-white font-bold text-[11px] truncate mb-0.5">{log.title}</div>
                    )}
                    <div className="text-slate-400 text-[10px] truncate" title={log.message}>{log.message}</div>
                  </td>
                  <td className="py-3.5">
                    {log.student ? (
                      <div>
                        <div className="text-white text-[11px] font-semibold">{log.student.name}</div>
                        <div className="text-slate-600 font-mono text-[9px]">{log.student.email?.split('@')[0]}</div>
                      </div>
                    ) : log.group ? (
                      <div className="text-teal-400 text-[11px] font-bold">👥 {log.group.name}</div>
                    ) : (
                      <span className="text-slate-600 text-[10px]">🌐 {isAr ? 'عام' : 'Global'}</span>
                    )}
                  </td>
                  <td className="py-3.5">
                    <PlatformBadge platform={log.platform} />
                  </td>
                  <td className="py-3.5">
                    <div className="text-slate-400 text-[10px]">
                      {new Date(log.sentTime).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                    </div>
                    <div className="text-slate-600 font-mono text-[9px]">
                      {new Date(log.sentTime).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="py-3.5 text-center">
                    <ReceiptBadge deliveredAt={log.deliveredAt} readAt={log.readAt} isAr={isAr} />
                  </td>
                  <td className="py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                      log.status === 'SENT'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : log.status === 'PENDING'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex justify-between items-center mt-5 pt-4 border-t border-slate-800/60">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 disabled:opacity-30 text-[10px] text-slate-400 hover:text-white rounded-lg transition"
            >{isAr ? '← السابق' : '← Prev'}</button>
            <span className="text-[10px] text-slate-500 font-mono">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 disabled:opacity-30 text-[10px] text-slate-400 hover:text-white rounded-lg transition"
            >{isAr ? 'التالي →' : 'Next →'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
