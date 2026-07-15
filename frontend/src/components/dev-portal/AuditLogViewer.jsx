import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const ACTION_COLORS = {
  CREATE: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  UPDATE: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  DELETE: 'text-red-400 bg-red-500/10 border-red-500/30',
  LOGIN:  'text-sky-400 bg-sky-500/10 border-sky-500/30',
  TOGGLE: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  PURGE:  'text-rose-400 bg-rose-500/10 border-rose-500/30',
};

function getActionColor(action) {
  const key = Object.keys(ACTION_COLORS).find(k => action?.toUpperCase().includes(k));
  return key ? ACTION_COLORS[key] : 'text-slate-400 bg-slate-500/10 border-slate-500/20';
}

function JsonDiffViewer({ data }) {
  const [expanded, setExpanded] = useState(false);
  if (!data || Object.keys(data).length === 0) {
    return <span className="text-slate-600 text-[10px]">—</span>;
  }
  const jsonStr = JSON.stringify(data, null, 2);
  const lines = jsonStr.split('\n').length;
  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="text-[10px] font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
      >
        <span>{expanded ? '▼' : '▶'}</span>
        <span>{expanded ? 'إخفاء JSON' : `عرض JSON (${lines} سطر)`}</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.pre
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 text-[9px] font-mono bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-300 overflow-x-auto max-w-xs max-h-40 overflow-y-auto leading-relaxed"
          >
            {jsonStr}
          </motion.pre>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AuditLogViewer({ API_URL, token, isAr, tenantFilter }) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [search, setSearch]   = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const limit = 15;

  const [rollbackLoadingId, setRollbackLoadingId] = useState(null);

  const isRollbackable = (log) => {
    const supportedTypes = ['Schedule', 'Room', 'Lecturer', 'Subject', 'Student', 'Group', 'VerificationCode'];
    const supportedActions = ['CREATE', 'UPDATE', 'DELETE'];
    return supportedActions.some(act => log.action?.toUpperCase().includes(act)) &&
           supportedTypes.includes(log.entityType);
  };

  const handleRollback = async (id) => {
    if (!window.confirm(isAr ? 'هل تريد التراجع عن هذه العملية وإعادة قاعدة البيانات للحالة السابقة؟' : 'Are you sure you want to rollback this change?')) return;
    setRollbackLoadingId(id);
    try {
      const res = await axios.post(`${API_URL}/api/admin/dev/audit-logs/rollback/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم التراجع عن العملية بنجاح! 🎉' : 'Rollback executed successfully! 🎉');
        fetchLogs();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل التراجع عن العملية' : 'Rollback failed'));
    } finally {
      setRollbackLoadingId(null);
    }
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit,
        search,
        action: actionFilter !== 'ALL' ? actionFilter : '',
        ...(tenantFilter?.collegeId  ? { collegeId: tenantFilter.collegeId }  : {}),
        ...(tenantFilter?.universityId ? { universityId: tenantFilter.universityId } : {}),
      });
      const res = await axios.get(`${API_URL}/api/admin/dev/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setLogs(res.data.data);
        setTotal(res.data.total);
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تحميل سجل التدقيق' : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, tenantFilter, API_URL, token]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const exportCSV = () => {
    if (!logs.length) return;
    const headers = ['ID', 'Action', 'Entity', 'Entity ID', 'Admin Email', 'IP Address', 'Timestamp'];
    const rows = logs.map(l => [
      l.id, l.action, l.entityType, l.entityId ?? '', l.userEmail, l.ipAddress,
      new Date(l.timestamp).toISOString()
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `audit_log_${Date.now()}.csv`; a.click();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-amber-400">📋</span>
            {isAr ? 'سجل التدقيق البصري الشامل' : 'Visual Audit Log'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {isAr
              ? 'كل عملية نفّذها أي مشرف في أي كلية موثقة هنا مع تفاصيل JSON الكاملة.'
              : 'Every admin action across all tenants — logged with full JSON change data.'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={fetchLogs}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-bold transition"
          >
            🔄 {isAr ? 'تحديث' : 'Refresh'}
          </button>
          <button
            onClick={exportCSV}
            className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-bold transition"
          >
            📥 {isAr ? 'تصدير CSV' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder={isAr ? 'ابحث بالبريد، الكيان، الـ IP...' : 'Search by email, entity, IP...'}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/40 transition"
        />
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/40 transition min-w-[160px]"
        >
          <option value="ALL">{isAr ? 'كل العمليات' : 'All Actions'}</option>
          <option value="CREATE">{isAr ? 'إنشاء' : 'CREATE'}</option>
          <option value="UPDATE">{isAr ? 'تعديل' : 'UPDATE'}</option>
          <option value="DELETE">{isAr ? 'حذف' : 'DELETE'}</option>
          <option value="LOGIN">{isAr ? 'تسجيل دخول' : 'LOGIN'}</option>
          <option value="TOGGLE">{isAr ? 'تبديل إعداد' : 'TOGGLE'}</option>
          <option value="PURGE">{isAr ? 'تطهير' : 'PURGE'}</option>
        </select>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-4 text-[10px] font-mono text-slate-500">
        <span>{isAr ? `إجمالي: ${total} عملية` : `Total: ${total} entries`}</span>
        <span>·</span>
        <span>{isAr ? `صفحة ${page} من ${totalPages || 1}` : `Page ${page}/${totalPages || 1}`}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="pb-3 text-left">#ID</th>
              <th className="pb-3 text-left">{isAr ? 'العملية' : 'Action'}</th>
              <th className="pb-3 text-left">{isAr ? 'الكيان' : 'Entity'}</th>
              <th className="pb-3 text-left">{isAr ? 'المشرف' : 'Admin'}</th>
              <th className="pb-3 text-left">{isAr ? 'عنوان IP' : 'IP'}</th>
              <th className="pb-3 text-left">{isAr ? 'التوقيت' : 'Timestamp'}</th>
              <th className="pb-3 text-left">{isAr ? 'بيانات التغيير' : 'Change Data'}</th>
              <th className="pb-3 text-right">{isAr ? 'إجراء' : 'Action'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="text-center py-12 text-slate-500 text-xs">
                <span className="animate-pulse">{isAr ? 'جاري التحميل...' : 'Loading audit logs...'}</span>
              </td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="8" className="text-center py-12 text-slate-600 text-xs">
                {isAr ? 'لا توجد سجلات تدقيق بعد' : 'No audit entries found'}
              </td></tr>
            ) : logs.map((log, idx) => (
              <motion.tr
                key={log.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="border-b border-slate-800/40 hover:bg-slate-800/10 transition duration-150"
              >
                <td className="py-3.5 font-mono text-[10px] text-slate-600">#{log.id}</td>
                <td className="py-3.5">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="py-3.5">
                  <div className="font-semibold text-white text-[11px]">{log.entityType}</div>
                  {log.entityId && (
                    <div className="text-[9px] font-mono text-slate-600 mt-0.5">ID: {log.entityId}</div>
                  )}
                </td>
                <td className="py-3.5">
                  <div className="text-slate-200 font-semibold">{log.userEmail?.split('@')[0]}</div>
                  <div className="text-[9px] text-slate-600 font-mono mt-0.5">{log.userEmail}</div>
                </td>
                <td className="py-3.5 font-mono text-[10px] text-slate-500">{log.ipAddress}</td>
                <td className="py-3.5 text-slate-400 text-[10px]">
                  <div>{new Date(log.timestamp).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>
                  <div className="font-mono text-slate-600 mt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US')}
                  </div>
                </td>
                <td className="py-3.5 max-w-[200px]">
                  <JsonDiffViewer data={log.details} />
                </td>
                <td className="py-3.5 text-right">
                  {isRollbackable(log) && (
                    <button
                      onClick={() => handleRollback(log.id)}
                      disabled={rollbackLoadingId === log.id}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/25 active:bg-amber-500/40 border border-amber-500/35 hover:border-amber-500 text-amber-400 font-bold rounded text-[9px] transition disabled:opacity-40"
                    >
                      {rollbackLoadingId === log.id ? (isAr ? 'جاري...' : 'Undoing...') : (isAr ? 'تراجع ↩️' : 'Undo ↩️')}
                    </button>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-800/80">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 disabled:opacity-30 text-xs text-slate-400 hover:text-white rounded-lg transition"
          >
            {isAr ? '← السابق' : '← Prev'}
          </button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page - 2 + i;
              if (p < 1 || p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-lg text-[10px] font-bold transition ${
                    p === page
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-slate-950 border border-slate-800 text-slate-500 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 disabled:opacity-30 text-xs text-slate-400 hover:text-white rounded-lg transition"
          >
            {isAr ? 'التالي →' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  );
}
