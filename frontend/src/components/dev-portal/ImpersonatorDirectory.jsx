import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export default function ImpersonatorDirectory({ API_URL, token, onImpersonate, isAr }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Mock list of blocked IPs & cyber threats
  const blockedIPs = [
    { ip: '198.51.100.42', reason: 'Brute-force attempts on student login', blockedAt: '2026-07-03' },
    { ip: '203.0.113.88', reason: 'SQL Injection signature detected on /reschedule', blockedAt: '2026-07-02' }
  ];

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [stdRes, lecRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/students`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/admin/lecturers`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const students = (stdRes.data?.data || []).map(u => ({ ...u, type: 'STUDENT' }));
      const lecturers = (lecRes.data?.data || []).map(u => ({ ...u, type: 'LECTURER' }));
      setUsers([...students, ...lecturers]);
    } catch (err) {
      toast.error(isAr ? 'فشل تحميل قائمة المحاكاة الإدارية' : 'Failed to fetch users list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSimulate = async (user) => {
    try {
      const payload = {};
      if (user.type === 'STUDENT') payload.studentId = user.id;
      else if (user.type === 'LECTURER') payload.lecturerId = user.id;
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

  const filteredUsers = users.filter(u => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.type && u.type.toLowerCase().includes(term))
    );
  });

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

        <div className="mb-6">
          <input
            type="text"
            placeholder={isAr ? 'ابحث باسم الطالب، الدكتور أو البريد الإلكتروني...' : 'Search by name, email, or role...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
          />
        </div>

        <div className="overflow-y-auto max-h-[450px] space-y-3 pr-2">
          {loading ? (
            <div className="text-center py-10 text-xs text-slate-400">
              {isAr ? 'جاري تحميل المستخدمين...' : 'Loading users list...'}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              {isAr ? 'لا يوجد مستخدمون مطابقون للبحث' : 'No users found'}
            </div>
          ) : (
            filteredUsers.map(user => (
              <div key={user.id + '-' + user.type} className="p-4 bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-xl flex justify-between items-center transition duration-150">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    {user.name}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      user.type === 'LECTURER' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    }`}>
                      {user.type}
                    </span>
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono block mt-1">{user.email}</span>
                </div>
                <button
                  onClick={() => handleSimulate(user)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px] transition duration-150 shadow-md shadow-rose-600/15"
                >
                  {isAr ? '🚀 محاكاة الدخول' : 'Simulate View'}
                </button>
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
    </div>
  );
}
