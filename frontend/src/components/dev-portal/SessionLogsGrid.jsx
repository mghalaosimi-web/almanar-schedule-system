import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import UserDetailsModal from '../UserDetailsModal';

// ── Duration formatter ────────────────────────────────────────────────────────
function sessionDuration(loginTime, logoutTime) {
  const end   = logoutTime ? new Date(logoutTime) : new Date();
  const start = new Date(loginTime);
  const ms    = end - start;
  const mins  = Math.floor(ms / 60000);
  const hrs   = Math.floor(mins / 60);
  if (hrs > 0)  return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m`;
  return '< 1m';
}

// ── Role Badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const map = {
    SUPER_ADMIN:   'bg-red-500/10 text-red-400 border-red-500/20',
    UNI_ADMIN:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
    COLLEGE_ADMIN: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    LECTURER:      'bg-sky-500/10 text-sky-400 border-sky-500/20',
    STUDENT:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black ${map[role] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {role}
    </span>
  );
}

// ── Session Status Indicator ─────────────────────────────────────────────────
function StatusDot({ session }) {
  if (session.isRevoked) {
    return <span className="flex items-center gap-1.5 text-red-400 text-[10px] font-bold"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0"/> REVOKED</span>;
  }
  if (session.logoutTime) {
    return <span className="flex items-center gap-1.5 text-slate-500 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0"/> ENDED</span>;
  }
  return <span className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0"/> ACTIVE</span>;
}

// ── Stats Strip ───────────────────────────────────────────────────────────────
function StatsStrip({ sessions, isAr }) {
  const active   = sessions.filter(s => !s.logoutTime && !s.isRevoked).length;
  const revoked  = sessions.filter(s => s.isRevoked).length;
  const students = sessions.filter(s => s.role === 'STUDENT').length;
  const admins   = sessions.filter(s => s.role?.includes('ADMIN')).length;
  return (
    <div className="flex flex-wrap gap-3 mb-5">
      {[
        { label: isAr ? 'نشط الآن' : 'Active',    val: active,   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        { label: isAr ? 'منهية' : 'Ended',         val: sessions.filter(s => s.logoutTime && !s.isRevoked).length, color: 'text-slate-400', bg: 'bg-slate-800/60 border-slate-700' },
        { label: isAr ? 'مطرود' : 'Revoked',       val: revoked,  color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
        { label: isAr ? 'طلاب' : 'Students',       val: students, color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/20' },
        { label: isAr ? 'مشرفون' : 'Admins',       val: admins,   color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
      ].map((s, i) => (
        <div key={i} className={`px-3 py-2 rounded-xl border ${s.bg} text-center min-w-[72px]`}>
          <div className={`text-base font-black font-mono ${s.color}`}>{s.val}</div>
          <div className="text-[8px] text-slate-500 uppercase tracking-wide mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main SessionLogsGrid ──────────────────────────────────────────────────────
export default function SessionLogsGrid({ API_URL, token, isAr, tenantFilter = {} }) {
  const [sessions,    setSessions]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [search,      setSearch]      = useState('');
  const [roleFilter,  setRoleFilter]  = useState('ALL');
  const [statusFilter, statusFilterFilter] = useState('ALL'); // ALL | ACTIVE | ENDED | REVOKED
  // rename statusFilter setting hook locally so we don't conflict with statusFilter variable
  const setStatusFilter = statusFilterFilter;
  const [page,        setPage]        = useState(1);
  const [total,       setTotal]       = useState(0);
  const [selected,    setSelected]    = useState(new Set());
  const [bulkKicking, setBulkKicking] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const limit = 15;
  const intervalRef = useRef(null);

  const [departments, setDepartments] = useState([]);
  const [majors, setMajors] = useState([]);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedMajor, setSelectedMajor] = useState('ALL');

  const [detailsEmail, setDetailsEmail] = useState('');
  const [detailsRole, setDetailsRole] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [activeGridTab, setActiveGridTab] = useState('directory');
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [shouldFetch, setShouldFetch] = useState(false);

  const fetchDirectory = useCallback(async () => {
    setLoadingDirectory(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'ALL') params.append('role', roleFilter);
      if (selectedDept !== 'ALL') params.append('departmentId', selectedDept);
      if (selectedMajor !== 'ALL') params.append('majorId', selectedMajor);
      if (search) params.append('search', search);
      if (tenantFilter.collegeId) params.append('collegeId', tenantFilter.collegeId);

      const res = await axios.get(`${API_URL}/api/admin/users/indexed-directory?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setDirectoryUsers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch indexed directory:', err);
      toast.error(isAr ? 'فشل تحميل الفهرس' : 'Failed to fetch directory');
    } finally {
      setLoadingDirectory(false);
    }
  }, [roleFilter, selectedDept, selectedMajor, search, tenantFilter.collegeId, API_URL, token, isAr]);

  useEffect(() => {
    if (activeGridTab === 'directory' && shouldFetch) {
      fetchDirectory();
    }
  }, [activeGridTab, fetchDirectory, shouldFetch]);

  // Reset shouldFetch when filter selections change to save bandwidth
  useEffect(() => {
    setShouldFetch(false);
  }, [roleFilter, selectedDept, selectedMajor, search, statusFilter]);

  useEffect(() => {
    if (tenantFilter.collegeId) {
      axios.get(`${API_URL}/api/departments?collegeId=${tenantFilter.collegeId}`)
        .then(res => {
          if (res.data?.success) setDepartments(res.data.data);
        })
        .catch(err => console.error('Failed to fetch departments:', err));

      axios.get(`${API_URL}/api/majors?collegeId=${tenantFilter.collegeId}`)
        .then(res => {
          if (res.data?.success) setMajors(res.data.data);
        })
        .catch(err => console.error('Failed to fetch majors:', err));
    } else {
      setDepartments([]);
      setMajors([]);
      setSelectedDept('ALL');
      setSelectedMajor('ALL');
    }
  }, [tenantFilter.collegeId, API_URL]);

  const fetchSessions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit, search });
      if (roleFilter   !== 'ALL') params.append('role',   roleFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (tenantFilter.collegeId)    params.append('collegeId',    tenantFilter.collegeId);
      if (tenantFilter.universityId) params.append('universityId', tenantFilter.universityId);
      if (selectedDept !== 'ALL') params.append('departmentId', selectedDept);
      if (selectedMajor !== 'ALL') params.append('majorId', selectedMajor);

      const res = await axios.get(`${API_URL}/api/admin/dev/sessions?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setSessions(res.data.data);
        setTotal(res.data.total);
        setLastRefresh(new Date());
      }
    } catch (err) {
      if (!silent) toast.error(isAr ? 'فشل تحميل الجلسات' : 'Failed to fetch sessions');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter, tenantFilter, selectedDept, selectedMajor, API_URL, token]);

  useEffect(() => {
    if (shouldFetch) {
      fetchSessions();
      intervalRef.current = setInterval(() => fetchSessions(true), 8000);
      return () => clearInterval(intervalRef.current);
    }
  }, [fetchSessions, shouldFetch]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter, tenantFilter, selectedDept, selectedMajor]);

  const handleRevoke = async (sessionId, email) => {
    if (!window.confirm(isAr ? `طرد ${email} فوراً؟` : `Kick out ${email} immediately?`)) return;
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/dev/sessions/revoke`,
        { sessionId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        toast.success(isAr ? `✅ تم طرد ${email}` : `✅ Kicked out ${email}`);
        fetchSessions(true);
      }
    } catch {
      toast.error(isAr ? 'فشل طرد المستخدم' : 'Kick failed');
    }
  };

  const handleBulkKick = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(isAr ? `طرد ${selected.size} جلسة دفعة واحدة؟` : `Bulk kick ${selected.size} sessions?`)) return;
    setBulkKicking(true);
    let done = 0;
    for (const id of selected) {
      try {
        await axios.post(`${API_URL}/api/admin/dev/sessions/revoke`, { sessionId: id }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        done++;
      } catch {}
    }
    toast.success(isAr ? `تم طرد ${done} جلسة بنجاح` : `Bulk kicked ${done} sessions`);
    setSelected(new Set());
    setBulkKicking(false);
    fetchSessions(true);
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllActive = () => {
    const active = sessions.filter(s => !s.logoutTime && !s.isRevoked);
    setSelected(new Set(active.map(s => s.id)));
  };

  const exportCSV = () => {
    if (!sessions.length) return;
    const rows = sessions.map(s => [
      s.id, s.userEmail, s.role, s.ipAddress,
      s.devicePlatform || '',
      new Date(s.loginTime).toISOString(),
      s.logoutTime ? new Date(s.logoutTime).toISOString() : '',
      sessionDuration(s.loginTime, s.logoutTime),
      s.isRevoked ? 'REVOKED' : s.logoutTime ? 'ENDED' : 'ACTIVE',
    ]);
    const csv = [['ID', 'Email', 'Role', 'IP', 'Platform', 'Login', 'Logout', 'Duration', 'Status'], ...rows]
      .map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `sessions_${Date.now()}.csv`; a.click();
  };

  const totalPages = Math.ceil(total / limit);
  const activeSessions = sessions.filter(s => !s.logoutTime && !s.isRevoked);

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
            {isAr ? 'مراقبة الجلسات الحية — Live Traffic' : 'Live Session Monitor — Traffic Control'}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isAr ? 'يُحدَّث تلقائياً كل 8 ثوان.' : 'Auto-refreshes every 8 seconds.'}
            {tenantFilter.collegeId && <span className="ml-2 text-teal-400 font-bold">🏫 College filter active</span>}
            {tenantFilter.universityId && !tenantFilter.collegeId && <span className="ml-2 text-blue-400 font-bold">🏛️ University filter active</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {selected.size > 0 && (
            <button
              onClick={handleBulkKick}
              disabled={bulkKicking}
              className="px-3 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black rounded-lg text-xs transition flex items-center gap-1.5"
            >
              {bulkKicking ? '⏳' : '🔴'} {isAr ? `طرد ${selected.size} جلسة` : `Kick ${selected.size} sessions`}
            </button>
          )}
          {activeSessions.length > 0 && (
            <button onClick={selectAllActive} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs transition">
              {isAr ? 'تحديد النشطة' : 'Select Active'}
            </button>
          )}
          <button onClick={() => fetchSessions()} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs transition">
            🔄 {isAr ? 'تحديث' : 'Refresh'}
          </button>
          <button onClick={exportCSV} className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold transition">
            📥 CSV
          </button>
        </div>
      </div>

      {/* Sub-tabs Switch */}
      <div className="flex gap-2 mb-6 border-b border-slate-800/60 pb-3 shrink-0">
        <button
          onClick={() => setActiveGridTab('directory')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
            activeGridTab === 'directory'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          📁 {isAr ? 'دليل الحسابات المفهرس' : 'Accounts Directory'}
        </button>
        <button
          onClick={() => setActiveGridTab('chronological')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
            activeGridTab === 'chronological'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          ⚡ {isAr ? 'سجل التدفق الزمني' : 'Live Session Feed'}
        </button>
      </div>

      {activeGridTab === 'chronological' && <StatsStrip sessions={sessions} isAr={isAr} />}

      {/* Filters row */}
      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder={isAr ? 'ابحث بالبريد، الدور، الـ IP...' : 'Search by email, role, IP...'}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 transition"
        />
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40 transition min-w-[140px]"
        >
          <option value="ALL">{isAr ? 'كل الأدوار' : 'All Roles'}</option>
          <option value="STUDENT">STUDENT</option>
          <option value="LECTURER">LECTURER</option>
          <option value="COLLEGE_ADMIN">COLLEGE_ADMIN</option>
          <option value="UNI_ADMIN">UNI_ADMIN</option>
          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
        </select>
        
        {tenantFilter.collegeId && (
          <>
            {/* Department filter */}
            <select
              value={selectedDept}
              onChange={e => { setSelectedDept(e.target.value); setSelectedMajor('ALL'); setPage(1); }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40 transition min-w-[140px] truncate"
            >
              <option value="ALL">{isAr ? 'كل الأقسام' : 'All Departments'}</option>
              {departments.map(d => (
                <option key={d.id} value={String(d.id)}>{d.name}</option>
              ))}
            </select>

            {/* Major/Specialization filter */}
            <select
              value={selectedMajor}
              onChange={e => { setSelectedMajor(e.target.value); setPage(1); }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40 transition min-w-[140px] truncate"
            >
              <option value="ALL">{isAr ? 'كل التخصصات' : 'All Specializations'}</option>
              {majors
                .filter(m => selectedDept === 'ALL' || String(m.departmentId) === selectedDept)
                .map(m => (
                  <option key={m.id} value={String(m.id)}>{m.name}</option>
                ))}
            </select>
          </>
        )}

        <div className="flex gap-1.5">
          {['ALL', 'ACTIVE', 'ENDED', 'REVOKED'].map(f => (
            <button
              key={f}
              onClick={() => { setStatusFilter(f); setPage(1); }}
              className={`px-2.5 py-2 rounded-lg text-[9px] font-bold border transition ${
                statusFilter === f
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-450 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-white'
              }`}
            >
              {f === 'ALL' ? (isAr ? 'الكل' : 'All') : f}
            </button>
          ))}
        </div>
      </div>

      {/* Scoped load action buttons */}
      <div className="flex gap-2.5 mb-6">
        <button
          onClick={() => {
            setShouldFetch(true);
            if (activeGridTab === 'directory') {
              setTimeout(() => fetchDirectory(), 50);
            } else {
              setTimeout(() => fetchSessions(), 50);
            }
          }}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-450 hover:to-teal-450 text-black font-black rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-500/15 cursor-pointer"
        >
          🔍 {isAr ? 'جلب البيانات الفني' : 'Load Scoped Data'}
        </button>
        <button
          onClick={() => {
            setRoleFilter('ALL');
            setSelectedDept('ALL');
            setSelectedMajor('ALL');
            setSearch('');
            setShouldFetch(true);
            setTimeout(() => {
              if (activeGridTab === 'directory') fetchDirectory();
              else fetchSessions();
            }, 50);
          }}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs transition cursor-pointer"
        >
          🌐 {isAr ? 'عرض الكل' : 'Show All'}
        </button>
      </div>

      {!shouldFetch ? (
        <div className="text-center py-16 border border-white/5 bg-slate-950/20 rounded-2xl flex flex-col items-center justify-center gap-4">
          <div className="text-4xl">📡</div>
          <div className="space-y-1">
            <h4 className="font-bold text-white text-sm">{isAr ? 'توفير استهلاك البيانات نشط' : 'Bandwidth Saving Active'}</h4>
            <p className="text-slate-500 text-[11px] max-w-md mx-auto leading-relaxed">
              {isAr 
                ? 'الرجاء تحديد معايير التصفية المطلوبة أعلاه ثم الضغط على "جلب البيانات الفني" لبدء العرض وتجنب استهلاك الإنترنت.' 
                : 'Please select filter criteria above and click "Load Scoped Data" to fetch directory or traffic.'}
            </p>
          </div>
        </div>
      ) : activeGridTab === 'directory' ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[9px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                <th className="pb-3 text-left">{isAr ? 'المستخدم' : 'User'}</th>
                <th className="pb-3 text-left">{isAr ? 'الدور' : 'Role'}</th>
                <th className="pb-3 text-left">{isAr ? 'القسم والتخصص' : 'Dept / Major'}</th>
                <th className="pb-3 text-center">{isAr ? 'الجلسات الحالية' : 'Active'}</th>
                <th className="pb-3 text-center">{isAr ? 'مجموع العمليات' : 'Activities'}</th>
                <th className="pb-3 text-center">{isAr ? 'السجل التفصيلي' : 'Record'}</th>
              </tr>
            </thead>
            <tbody>
              {loadingDirectory ? (
                <tr><td colSpan="6" className="text-center py-12 text-slate-500 text-xs">
                  <span className="animate-pulse">{isAr ? 'جاري تحميل الدليل...' : 'Loading directory...'}</span>
                </td></tr>
              ) : directoryUsers.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-12 text-slate-650 text-xs">
                  {isAr ? 'لا توجد حسابات مطابقة' : 'No accounts found'}
                </td></tr>
              ) : directoryUsers.map((u, idx) => (
                <motion.tr
                  key={u.email}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.01 }}
                  className="border-b border-slate-800/40 hover:bg-slate-800/10 transition duration-150"
                >
                  <td className="py-3.5">
                    <div className="text-white font-semibold text-[11px]">{u.name || u.email?.split('@')[0]}</div>
                    <div className="text-[9px] font-mono text-slate-500 mt-0.5">{u.email}</div>
                  </td>
                  <td className="py-3.5"><RoleBadge role={u.role} /></td>
                  <td className="py-3.5">
                    <div className="text-slate-300 text-[10px]">{u.department}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">{u.major} {u.level !== 'N/A' && `· ${u.level}`} {u.group !== 'N/A' && `· ${u.group}`}</div>
                  </td>
                  <td className="py-3.5 text-center">
                    {u.activeSessionsCount > 0 ? (
                      <span className="px-2.5 py-0.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 font-bold font-mono text-[10px]">
                        🟢 {u.activeSessionsCount} active
                      </span>
                    ) : (
                      <span className="text-slate-650 font-mono text-[10px]">0 active</span>
                    )}
                  </td>
                  <td className="py-3.5 text-center">
                    <span className="px-1.5 py-0.5 rounded bg-slate-850 text-slate-400 font-mono text-[9px] font-bold border border-slate-700">
                      🔧 {u.totalActivitiesCount} actions
                    </span>
                  </td>
                  <td className="py-3.5 text-center">
                    <button
                      onClick={() => {
                        setDetailsEmail(u.email);
                        setDetailsRole(u.role);
                        setShowDetailsModal(true);
                      }}
                      className="px-2.5 py-1 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 hover:from-emerald-500 hover:to-teal-500 hover:text-black text-emerald-400 border border-emerald-500/20 rounded-lg text-[9px] font-black transition cursor-pointer"
                    >
                      🔍 {isAr ? 'عرض التفاصيل والسجل' : 'View Record & Activity'}
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* Total + last refresh */}
          <div className="flex gap-4 text-[9px] font-mono text-slate-600 mb-3">
            <span>{total} {isAr ? 'جلسة' : 'sessions'}</span>
            {lastRefresh && <span>· {isAr ? 'آخر تحديث' : 'Refreshed'}: {lastRefresh.toLocaleTimeString()}</span>}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs font-sans">
              <thead>
                <tr className="border-b border-slate-800 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="pb-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === activeSessions.length && activeSessions.length > 0}
                      onChange={e => e.target.checked ? selectAllActive() : setSelected(new Set())}
                      className="w-3.5 h-3.5 rounded accent-emerald-500"
                    />
                  </th>
                  <th className="pb-3 text-left">{isAr ? 'المستخدم' : 'User'}</th>
                  <th className="pb-3 text-left">{isAr ? 'الدور' : 'Role'}</th>
                  <th className="pb-3 text-left">{isAr ? 'الـ IP والمنصة' : 'IP & Platform'}</th>
                  <th className="pb-3 text-left">{isAr ? 'وقت الدخول' : 'Login Time'}</th>
                  <th className="pb-3 text-left">{isAr ? 'المدة' : 'Duration'}</th>
                  <th className="pb-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="pb-3 text-center">{isAr ? 'التفاصيل' : 'Details'}</th>
                  <th className="pb-3 text-center">{isAr ? 'طرد' : 'Kick'}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" className="text-center py-12 text-slate-500 text-xs">
                    <span className="animate-pulse">{isAr ? 'جاري تحميل الجلسات...' : 'Loading sessions...'}</span>
                  </td></tr>
                ) : sessions.length === 0 ? (
                  <tr><td colSpan="9" className="text-center py-12 text-slate-650 text-xs">
                    {isAr ? 'لا توجد جلسات مطابقة' : 'No sessions found'}
                  </td></tr>
                ) : sessions.map((s, idx) => {
                  const isActive  = !s.logoutTime && !s.isRevoked;
                  const isChecked = selected.has(s.id);
                  return (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.015 }}
                      className={`border-b border-slate-800/40 transition duration-150 ${isChecked ? 'bg-red-500/5' : 'hover:bg-slate-800/10'}`}
                    >
                      <td className="py-3.5">
                        {isActive && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(s.id)}
                            className="w-3.5 h-3.5 rounded accent-red-500"
                          />
                        )}
                      </td>
                      <td className="py-3.5">
                        <div className="text-white font-semibold text-[11px]">{s.userEmail?.split('@')[0]}</div>
                        <div className="text-[9px] font-mono text-slate-600">{s.userEmail}</div>
                      </td>
                      <td className="py-3.5"><RoleBadge role={s.role} /></td>
                      <td className="py-3.5">
                        <div className="font-mono text-[10px] text-slate-400">{s.ipAddress}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span>{s.deviceOs ? (s.deviceOs.toLowerCase().includes('win') ? '💻' : s.deviceOs.toLowerCase().includes('android') ? '🤖' : s.deviceOs.toLowerCase().includes('ios') || s.deviceOs.toLowerCase().includes('mac') ? '🍎' : '📱') : '💻'}</span>
                          <span className="font-semibold text-slate-400">{s.deviceOs || 'Web'}</span>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-500">{s.browser || 'Chrome'}</span>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <div className="text-slate-400 text-[10px]">{new Date(s.loginTime).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>
                        <div className="font-mono text-[9px] text-slate-600">{new Date(s.loginTime).toLocaleTimeString()}</div>
                      </td>
                      <td className="py-3.5">
                        <span className={`font-mono text-[10px] ${isActive ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                          {sessionDuration(s.loginTime, s.logoutTime)}
                        </span>
                      </td>
                      <td className="py-3.5 text-center"><StatusDot session={s} /></td>
                      <td className="py-3.5 text-center">
                        <button
                          onClick={() => {
                            setDetailsEmail(s.userEmail);
                            setDetailsRole(s.role);
                            setShowDetailsModal(true);
                          }}
                          className="px-2 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-[9px] font-bold transition cursor-pointer"
                        >
                          🔍 {isAr ? 'تفاصيل' : 'Details'}
                        </button>
                      </td>
                      <td className="py-3.5 text-center">
                        {isActive && (
                          <button
                            onClick={() => handleRevoke(s.id, s.userEmail)}
                            className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-[9px] font-bold transition cursor-pointer"
                          >
                            🔴 {isAr ? 'طرد' : 'Kick'}
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex justify-between items-center mt-5 pt-4 border-t border-slate-800/60 font-sans">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 disabled:opacity-30 text-[10px] text-slate-400 hover:text-white rounded-lg transition"
              >{isAr ? '← السابق' : '← Prev'}</button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = page <= 3 ? i + 1 : page - 2 + i;
                  if (p < 1 || p > totalPages) return null;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded-lg text-[9px] font-bold transition ${
                        p === page ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-950 border border-slate-800 text-slate-500 hover:text-white'
                      }`}>{p}</button>
                  );
                })}
              </div>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 disabled:opacity-30 text-[10px] text-slate-400 hover:text-white rounded-lg transition"
              >{isAr ? 'التالي →' : 'Next →'}</button>
            </div>
          )}
        </>
      )}

      <UserDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        email={detailsEmail}
        role={detailsRole}
        API_URL={API_URL}
        token={token}
        isAr={isAr}
      />
    </div>
  );
}
