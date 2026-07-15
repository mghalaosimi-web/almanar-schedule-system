import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

// ── Mini Donut Chart using Pure SVG ──────────────────────────────────────────
function MiniDonut({ data, title, isAr }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let accumulatedAngle = 0;

  const colors = [
    'stroke-blue-500',
    'stroke-emerald-500',
    'stroke-purple-500',
    'stroke-amber-500',
    'stroke-pink-500',
    'stroke-indigo-500'
  ];

  return (
    <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex items-center gap-4">
      {/* SVG Circle */}
      <div className="relative w-16 h-16 shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.915" fill="none" className="stroke-slate-800" strokeWidth="3" />
          {total > 0 && data.map((item, index) => {
            const percentage = (item.count / total) * 100;
            const strokeDasharray = `${percentage} ${100 - percentage}`;
            const strokeDashoffset = 100 - accumulatedAngle;
            accumulatedAngle += percentage;
            const colorClass = colors[index % colors.length];

            return (
              <circle
                key={item.name}
                cx="18"
                cy="18"
                r="15.915"
                fill="none"
                className={`transition-all duration-1000 ${colorClass}`}
                strokeWidth="3.2"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-black font-mono text-white">{total}</span>
          <span className="text-[7px] text-slate-500 font-bold uppercase">{isAr ? 'جلسة' : 'Sess'}</span>
        </div>
      </div>

      {/* Legend list */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{title}</div>
        {total === 0 ? (
          <div className="text-[9px] text-slate-600">{isAr ? 'لا توجد بيانات' : 'No data'}</div>
        ) : (
          data.slice(0, 3).map((item, index) => {
            const pct = Math.round((item.count / total) * 100);
            const dotColor = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500'][index % 5];
            return (
              <div key={item.name} className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-slate-500 truncate flex items-center gap-1.5 min-w-0 pr-1">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="text-slate-350 font-mono shrink-0">{pct}%</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main DeviceStatsPanel ──────────────────────────────────────────────────────
export default function DeviceStatsPanel({ API_URL, token, isAr }) {
  const [stats, setStats] = useState({ os: [], browser: [], sessions: [] });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/dev/device-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تحميل إحصائيات الأجهزة' : 'Failed to fetch device stats');
    } finally {
      setLoading(false);
    }
  }, [API_URL, token, isAr]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const getDeviceIcon = (os) => {
    const o = String(os).toLowerCase();
    if (o.includes('win')) return '💻';
    if (o.includes('mac') || o.includes('ios')) return '🍎';
    if (o.includes('android')) return '🤖';
    if (o.includes('linux')) return '🐧';
    return '📱';
  };

  return (
    <div className="space-y-6">
      {/* Top donut widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MiniDonut
          data={stats.os}
          title={isAr ? 'أنظمة التشغيل المكتشفة' : 'Operating Systems'}
          isAr={isAr}
        />
        <MiniDonut
          data={stats.browser}
          title={isAr ? 'المتصفحات المستخدمة' : 'Web Browsers'}
          isAr={isAr}
        />
      </div>

      {/* Device Activity Table */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>📱</span>
              {isAr ? 'أحدث الأجهزة المسجلة' : 'Recent Device Logins'}
            </h3>
            <p className="text-[9px] text-slate-500 mt-0.5">
              {isAr ? 'مراقبة نظام التشغيل والمتصفح ونسخة التطبيق لكل جلسة بنجاح.' : 'Audit logs mapping platform OS, browser engine, and app version.'}
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchStats(); }}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded-lg transition"
          >
            {isAr ? 'تحديث 🔄' : 'Refresh 🔄'}
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs animate-pulse">
            {isAr ? 'جاري جلب إحصائيات الأجهزة...' : 'Loading device analytics...'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-500 uppercase tracking-wider text-[8px] font-black">
                  <th className="py-2.5 px-3">{isAr ? 'المستخدم' : 'User'}</th>
                  <th className="py-2.5 px-3 text-center">{isAr ? 'نظام التشغيل' : 'OS'}</th>
                  <th className="py-2.5 px-3 text-center">{isAr ? 'المتصفح' : 'Browser'}</th>
                  <th className="py-2.5 px-3 text-center">{isAr ? 'النسخة' : 'App Ver'}</th>
                  <th className="py-2.5 px-3 text-center">{isAr ? 'عنوان IP' : 'IP Address'}</th>
                  <th className="py-2.5 px-3 text-right">{isAr ? 'وقت الدخول' : 'Login Time'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {stats.sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-850/30 transition-colors">
                    <td className="py-2.5 px-3 min-w-[120px]">
                      <span className="text-white font-semibold block truncate">{session.userEmail.split('@')[0]}</span>
                      <span className="text-[8px] text-slate-500 font-mono tracking-wider">{session.role}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 bg-slate-950/60 border border-slate-800 px-2 py-0.5 rounded-full font-bold">
                        <span>{getDeviceIcon(session.deviceOs)}</span>
                        <span>{session.deviceOs || 'Web'}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold text-slate-300">
                      {session.browser || 'Chrome'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[9px] text-slate-400">
                      v{session.appVersion || '3.5.0'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                      {session.ipAddress}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      {new Date(session.loginTime).toLocaleString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
