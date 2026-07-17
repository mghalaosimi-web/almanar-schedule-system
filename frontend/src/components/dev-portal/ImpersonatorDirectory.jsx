import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import UserDetailsModal from '../UserDetailsModal';

export default function ImpersonatorDirectory({ API_URL, token, onImpersonate, isAr }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [departments, setDepartments] = useState([]);
  const [majors, setMajors] = useState([]);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedMajor, setSelectedMajor] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');
  
  const [shouldFetch, setShouldFetch] = useState(false);

  const [detailsEmail, setDetailsEmail] = useState('');
  const [detailsRole, setDetailsRole] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Mock list of blocked IPs & cyber threats
  const blockedIPs = [
    { ip: '198.51.100.42', reason: 'Brute-force attempts on student login', blockedAt: '2026-07-03' },
    { ip: '203.0.113.88', reason: 'SQL Injection signature detected on /reschedule', blockedAt: '2026-07-02' }
  ];

  useEffect(() => {
    // Fetch departments and majors for filtering
    axios.get(`${API_URL}/api/departments`)
      .then(res => { if (res.data?.success) setDepartments(res.data.data); })
      .catch(err => console.error('Failed to fetch departments:', err));

    axios.get(`${API_URL}/api/majors`)
      .then(res => { if (res.data?.success) setMajors(res.data.data); })
      .catch(err => console.error('Failed to fetch majors:', err));
  }, [API_URL]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedRole !== 'ALL') params.append('role', selectedRole);
      if (selectedDept !== 'ALL') params.append('departmentId', selectedDept);
      if (selectedMajor !== 'ALL') params.append('majorId', selectedMajor);
      if (search) params.append('search', search);

      const res = await axios.get(`${API_URL}/api/admin/users/indexed-directory?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تحميل قائمة المحاكاة الإدارية' : 'Failed to fetch users list');
    } finally {
      setLoading(false);
    }
  }, [selectedRole, selectedDept, selectedMajor, search, API_URL, token, isAr]);

  useEffect(() => {
    if (shouldFetch) {
      fetchUsers();
    }
  }, [shouldFetch, fetchUsers]);

  // Reset shouldFetch when filters change to save bandwidth
  useEffect(() => {
    setShouldFetch(false);
  }, [selectedRole, selectedDept, selectedMajor, search]);

  const handleSimulate = async (user) => {
    try {
      const payload = {};
      const uType = user.role || user.type;
      if (uType === 'STUDENT') payload.studentId = user.id;
      else if (uType === 'LECTURER') payload.lecturerId = user.id;
      else payload.adminId = user.id;

      const res = await axios.post(
        `${API_URL}/api/auth/impersonate`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        toast.success(isAr ? `جاري الانتقال لمحاكاة حساب: ${user.name}` : `Simulating account: ${user.name}`);
        onImpersonate(res.data.token, res.data.user || user);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل محاكاة الحساب' : 'Impersonation failed'));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Impersonation simulator (2 shares) */}
      <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-rose-500/20 rounded-2xl p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <span className="text-rose-400">👤</span>
          {isAr ? 'محاكاة صلاحيات الحسابات (God Mode Simulator)' : 'God Mode Account Simulator'}
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          {isAr ? 'البحث عن أي طالب أو دكتور مسجل بالنظام والولوج لحسابه فوراً لرؤية النظام بمنظوره.' : 'Simulate the exact dashboard perspective of any user with 1 click.'}
        </p>

        {/* Filters grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
          <input
            type="text"
            placeholder={isAr ? 'البحث باسم المستخدم أو البريد...' : 'Search by name or email...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-rose-500/40 transition"
          />
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500/40 transition truncate"
          >
            <option value="ALL">{isAr ? 'كل الأدوار' : 'All Roles'}</option>
            <option value="STUDENT">STUDENT</option>
            <option value="LECTURER">LECTURER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <select
            value={selectedDept}
            onChange={e => { setSelectedDept(e.target.value); setSelectedMajor('ALL'); }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500/40 transition truncate"
          >
            <option value="ALL">{isAr ? 'كل الأقسام' : 'All Departments'}</option>
            {departments.map(d => (
              <option key={d.id} value={String(d.id)}>{d.name}</option>
            ))}
          </select>
          <select
            value={selectedMajor}
            onChange={e => setSelectedMajor(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500/40 transition truncate"
          >
            <option value="ALL">{isAr ? 'كل التخصصات' : 'All Specializations'}</option>
            {majors
              .filter(m => selectedDept === 'ALL' || String(m.departmentId) === selectedDept)
              .map(m => (
                <option key={m.id} value={String(m.id)}>{m.name}</option>
              ))}
          </select>
        </div>

        {/* Load buttons */}
        <div className="flex gap-2.5 mb-6">
          <button
            onClick={() => setShouldFetch(true)}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-black rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-rose-600/15 cursor-pointer"
          >
            🔍 {isAr ? 'جلب الحسابات المفهرسة' : 'Load Scoped Accounts'}
          </button>
          <button
            onClick={() => {
              setSelectedRole('ALL');
              setSelectedDept('ALL');
              setSelectedMajor('ALL');
              setSearch('');
              setShouldFetch(true);
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs transition cursor-pointer"
          >
            🌐 {isAr ? 'عرض الكل' : 'Show All'}
          </button>
        </div>

        <div className="overflow-y-auto max-h-[450px] space-y-3 pr-2">
          {!shouldFetch ? (
            <div className="text-center py-16 border border-white/5 bg-slate-950/20 rounded-2xl flex flex-col items-center justify-center gap-4">
              <div className="text-4xl">🔐</div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">{isAr ? 'توفير استهلاك البيانات نشط' : 'Bandwidth Saving Active'}</h4>
                <p className="text-slate-500 text-[11px] max-w-sm mx-auto leading-relaxed">
                  {isAr 
                    ? 'الرجاء تحديد معايير التصفية والضغط على "جلب الحسابات المفهرسة" لبدء الولوج والمحاكاة.' 
                    : 'Please select filter criteria and click "Load Scoped Accounts" to view simulator directory.'}
                </p>
              </div>
            </div>
          ) : loading ? (
            <div className="text-center py-10 text-xs text-slate-400">
              {isAr ? 'جاري تحميل المستخدمين...' : 'Loading users list...'}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              {isAr ? 'لا يوجد مستخدمون مطابقون للبحث' : 'No users found'}
            </div>
          ) : (
            users.map(user => (
              <div key={user.id + '-' + (user.role || user.type)} className="p-4 bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-xl flex justify-between items-center transition duration-150">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    {user.name}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      (user.role || user.type) === 'LECTURER' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    }`}>
                      {user.role || user.type}
                    </span>
                    {user.isRepresentative && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {isAr ? 'مندوب' : 'Representative'}
                      </span>
                    )}
                  </h4>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    <span>{user.email}</span>
                    {user.department && user.department !== 'N/A' && (
                      <span className="text-slate-650 ml-2">· {user.department} / {user.major}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setDetailsEmail(user.email);
                      setDetailsRole(user.role || user.type);
                      setShowDetailsModal(true);
                    }}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold rounded-lg text-[10px] transition cursor-pointer"
                  >
                    🔍 {isAr ? 'سجل العمليات' : 'Record'}
                  </button>
                  <button
                    onClick={() => handleSimulate(user)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px] transition duration-150 shadow-md shadow-rose-600/15 cursor-pointer"
                  >
                    {isAr ? '🚀 محاكاة' : 'Simulate'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Cyber Security Watch (1 share) */}
      <div className="space-y-6">
        {/* Active developer status */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <h4 className="text-xs font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            {isAr ? 'حالة المطور الفيدرالي' : 'Developer Environment'}
          </h4>
          <div className="space-y-3 text-[10px] text-slate-400 font-mono">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span>ACCESS ROLE:</span>
              <span className="text-rose-500 font-bold">SUPER_ADMIN (GOD MODE)</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span>SECURE IMPERSONATOR:</span>
              <span className="text-emerald-400">ENABLED</span>
            </div>
            <div className="flex justify-between pb-1">
              <span>ENCRYPTION DECODING:</span>
              <span className="text-slate-300">SYSTEM DECRYPTED</span>
            </div>
          </div>
        </div>

        {/* Cyber Logs and Blocked IPs */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-rose-500/20 rounded-2xl p-6 shadow-2xl">
          <h4 className="text-xs font-bold text-white mb-4 flex items-center gap-1.5">
            <span>🛡️</span>
            {isAr ? 'العناوين المحظورة (Blocked IPs)' : 'Intrusion Blocked IPs'}
          </h4>
          <div className="space-y-4">
            {blockedIPs.map((ip, i) => (
              <div key={i} className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-rose-400 font-mono">{ip.ip}</span>
                  <span className="text-slate-500 font-mono">{ip.blockedAt}</span>
                </div>
                <p className="text-[9px] text-slate-400 leading-normal">{ip.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

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
