import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';

// ── Pure CSS Mini Sparkline Bar Chart ─────────────────────────────────────────
function SparkBar({ values, color, maxVal, label }) {
  const max = maxVal || Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-10">
      {values.map((v, i) => {
        const pct = max > 0 ? (v / max) * 100 : 0;
        return (
          <div
            key={i}
            title={`${label}: ${v}`}
            className={`flex-1 rounded-sm transition-all duration-500 ${color}`}
            style={{ height: `${Math.max(pct, 3)}%`, opacity: 0.4 + (pct / 100) * 0.6 }}
          />
        );
      })}
    </div>
  );
}

// ── Full 24-Hour Activity Chart ───────────────────────────────────────────────
function ActivityChart({ hourlyData, isAr }) {
  const logins  = hourlyData.map(h => h.logins  || 0);
  const logouts = hourlyData.map(h => h.logouts || 0);
  const maxVal  = Math.max(...logins, ...logouts, 1);
  const now     = new Date().getHours();

  return (
    <div className="relative">
      {/* Y-axis labels */}
      <div className="flex gap-1 items-end h-28 mb-1">
        {hourlyData.map((h, i) => {
          const loginPct  = (h.logins  || 0) / maxVal * 100;
          const logoutPct = (h.logouts || 0) / maxVal * 100;
          const isNowHour = i === now;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 relative group">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[9px] whitespace-nowrap z-10 opacity-0 group-hover:opacity-100 transition pointer-events-none shadow-xl">
                <div className="text-slate-400 font-bold mb-0.5">{String(i).padStart(2, '0')}:00</div>
                <div className="text-emerald-400">▲ {h.logins || 0} {isAr ? 'دخول' : 'logins'}</div>
                <div className="text-red-400">▼ {h.logouts || 0} {isAr ? 'خروج' : 'logouts'}</div>
              </div>

              {/* Stacked bars */}
              <div className="flex gap-0.5 items-end w-full h-24">
                {/* Login bar */}
                <div
                  className={`flex-1 rounded-t-sm transition-all duration-700 ${isNowHour ? 'bg-emerald-400' : 'bg-emerald-500/40'}`}
                  style={{ height: `${Math.max(loginPct, 2)}%` }}
                />
                {/* Logout bar */}
                <div
                  className={`flex-1 rounded-t-sm transition-all duration-700 ${isNowHour ? 'bg-red-400' : 'bg-red-500/40'}`}
                  style={{ height: `${Math.max(logoutPct, 2)}%` }}
                />
              </div>

              {/* Hour label — show every 3 hours */}
              <div className={`text-[8px] font-mono ${isNowHour ? 'text-white font-bold' : 'text-slate-600'}`}>
                {i % 3 === 0 ? String(i).padStart(2, '0') : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Role Breakdown Mini Donuts ────────────────────────────────────────────────
function RoleBreakdown({ sessions, isAr }) {
  const counts = sessions.reduce((acc, s) => {
    acc[s.role] = (acc[s.role] || 0) + 1;
    return acc;
  }, {});
  const total = sessions.length;
  const roles = [
    { key: 'STUDENT',      icon: '👨‍🎓', label: isAr ? 'طالب' : 'Student',      color: 'text-sky-400',    bar: 'bg-sky-500'    },
    { key: 'LECTURER',     icon: '👨‍🏫', label: isAr ? 'محاضر' : 'Lecturer',    color: 'text-teal-400',   bar: 'bg-teal-500'   },
    { key: 'COLLEGE_ADMIN',icon: '🏛️', label: isAr ? 'مشرف' : 'Admin',        color: 'text-amber-400',  bar: 'bg-amber-500'  },
    { key: 'SUPER_ADMIN',  icon: '⚡', label: isAr ? 'سوبر' : 'SuperAdmin',    color: 'text-purple-400', bar: 'bg-purple-500' },
  ];
  return (
    <div className="space-y-2.5">
      {roles.map(r => {
        const count = counts[r.key] || 0;
        const pct   = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={r.key}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <span>{r.icon}</span>
                <span>{r.label}</span>
              </span>
              <span className={`text-[10px] font-black font-mono ${r.color}`}>{count}</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full ${r.bar} rounded-full`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Active User Live Feed ─────────────────────────────────────────────────────
function LiveFeed({ sessions, isAr }) {
  const active = sessions.filter(s => !s.isRevoked && !s.logoutTime).slice(0, 8);
  return (
    <div className="space-y-1.5 max-h-52 overflow-y-auto">
      {active.length === 0 ? (
        <div className="text-center text-slate-600 text-[10px] py-4">
          {isAr ? 'لا يوجد مستخدمون نشطون الآن' : 'No active sessions now'}
        </div>
      ) : active.map(s => (
        <motion.div
          key={s.id}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 px-3 py-2 bg-slate-950/60 border border-slate-800/60 rounded-lg"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-white font-semibold truncate">{s.userEmail?.split('@')[0]}</div>
            <div className="text-[9px] text-slate-600 font-mono">{s.role} · {s.ipAddress}</div>
          </div>
          <div className="text-[8px] text-slate-600 font-mono shrink-0">
            {new Date(s.loginTime).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Main LiveTelemetryChart ───────────────────────────────────────────────────
export default function LiveTelemetryChart({ API_URL, token, isAr }) {
  const [hourlyData, setHourlyData] = useState(Array.from({ length: 24 }, (_, i) => ({ hour: i, logins: 0, logouts: 0 })));
  const [sessions,   setSessions]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [totalToday, setTotalToday] = useState({ logins: 0, logouts: 0, peak: 0, peakHour: 0 });
  const intervalRef = useRef(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [chartRes, sessionRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/dev/login-activity-chart`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/admin/dev/sessions?page=1&limit=100`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
      ]);

      if (chartRes.data?.success) {
        const data = chartRes.data.data;
        setHourlyData(data);
        const totalLogins  = data.reduce((s, h) => s + (h.logins  || 0), 0);
        const totalLogouts = data.reduce((s, h) => s + (h.logouts || 0), 0);
        const peakEntry    = data.reduce((a, b) => (b.logins || 0) > (a.logins || 0) ? b : a, data[0]);
        setTotalToday({
          logins:   totalLogins,
          logouts:  totalLogouts,
          peak:     peakEntry?.logins || 0,
          peakHour: peakEntry?.hour   || 0,
        });
      }

      if (sessionRes.data?.success) {
        setSessions(sessionRes.data.data || []);
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.warn('LiveTelemetryChart fetch error:', err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [API_URL, token]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(() => fetchData(true), 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  const activeCount = sessions.filter(s => !s.isRevoked && !s.logoutTime).length;

  return (
    <div className="space-y-6">
      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: isAr ? 'تسجيلات الدخول اليوم' : "Today's Logins",
            value: totalToday.logins,
            icon: '📈', color: 'text-emerald-400',
          },
          {
            label: isAr ? 'تسجيلات الخروج اليوم' : "Today's Logouts",
            value: totalToday.logouts,
            icon: '📉', color: 'text-red-400',
          },
          {
            label: isAr ? 'نشطون الآن' : 'Active Now',
            value: activeCount,
            icon: '🟢', color: 'text-sky-400',
            pulse: true,
          },
          {
            label: isAr ? 'ذروة اليوم' : 'Peak Hour',
            value: `${totalToday.peak} @ ${String(totalToday.peakHour).padStart(2, '0')}:00`,
            icon: '⚡', color: 'text-amber-400',
          },
        ].map((c, i) => (
          <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              {c.pulse ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
              ) : (
                <span className="text-sm">{c.icon}</span>
              )}
              <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">{c.label}</span>
            </div>
            <div className={`text-xl font-black font-mono ${c.color}`}>
              {loading ? '...' : c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Main Chart + Right Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-sky-400">📊</span>
                {isAr ? 'نشاط الدخول والخروج — آخر 24 ساعة' : 'Login / Logout Activity — Last 24 Hours'}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {isAr ? 'تحديث تلقائي كل 10 ثوان' : 'Auto-refreshes every 10 seconds'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-bold">
              <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block"/>  {isAr ? 'دخول' : 'Login'}</span>
              <span className="flex items-center gap-1 text-red-400"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block"/> {isAr ? 'خروج' : 'Logout'}</span>
            </div>
          </div>

          {loading ? (
            <div className="h-32 flex items-center justify-center">
              <span className="animate-pulse text-slate-500 text-xs">{isAr ? 'جاري تحميل الرسم البياني...' : 'Loading chart...'}</span>
            </div>
          ) : (
            <ActivityChart hourlyData={hourlyData} isAr={isAr} />
          )}

          {lastUpdate && (
            <div className="mt-3 text-[9px] text-slate-600 font-mono text-right">
              {isAr ? 'آخر تحديث:' : 'Last update:'}{' '}
              {lastUpdate.toLocaleTimeString(isAr ? 'ar-EG' : 'en-US')}
            </div>
          )}
        </div>

        {/* Right panels */}
        <div className="space-y-4">
          {/* Role breakdown */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <h4 className="text-xs font-bold text-white mb-4 flex items-center gap-1.5">
              <span>👥</span>
              {isAr ? 'توزيع حسب الدور' : 'Breakdown by Role'}
            </h4>
            <RoleBreakdown sessions={sessions} isAr={isAr} />
          </div>

          {/* Live feed */}
          <div className="bg-slate-900/60 border border-emerald-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <h4 className="text-xs font-bold text-white">
                {isAr ? 'الجلسات النشطة الآن' : 'Live Active Sessions'}
                <span className="ml-1.5 text-emerald-400 font-mono">({activeCount})</span>
              </h4>
            </div>
            <LiveFeed sessions={sessions} isAr={isAr} />
          </div>
        </div>
      </div>
    </div>
  );
}
