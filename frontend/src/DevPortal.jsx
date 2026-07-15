import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API_URL } from './config';
import { toast } from 'react-hot-toast';

// Import modular portal components
import SessionLogsGrid       from './components/dev-portal/SessionLogsGrid';
import GlobalNotificationsGrid from './components/dev-portal/GlobalNotificationsGrid';
import MasterDataManager     from './components/dev-portal/MasterDataManager';
import EngineRoom            from './components/dev-portal/EngineRoom';
import TenantsManager        from './components/dev-portal/TenantsManager';
import ImpersonatorDirectory from './components/dev-portal/ImpersonatorDirectory';
import AuditLogViewer        from './components/dev-portal/AuditLogViewer';
import DeepBranchManager     from './components/dev-portal/DeepBranchManager';
import LiveTelemetryChart    from './components/dev-portal/LiveTelemetryChart';
import BackupManager         from './components/dev-portal/BackupManager';
import ApiRequestInspector  from './components/dev-portal/ApiRequestInspector';
import DeviceStatsPanel     from './components/dev-portal/DeviceStatsPanel';
import AIPredictiveInsights from './components/dev-portal/AIPredictiveInsights';
import SqlTerminal          from './components/dev-portal/SqlTerminal';
import DbIntegrationMap     from './components/dev-portal/DbIntegrationMap';
import SelfHealingPatcher   from './components/dev-portal/SelfHealingPatcher';

// ── Mini Stat Card ────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color = 'text-white', pulse = false }) {
  return (
    <div className="px-4 py-2.5 bg-black/40 border border-white/5 backdrop-blur-md rounded-xl flex items-center gap-3 shrink-0">
      {pulse && <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-ping shrink-0" />}
      {!pulse && <span className="text-sm shrink-0">{icon}</span>}
      <div>
        <span className="text-[9px] text-white/40 font-black block uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-mono font-bold ${color}`}>{value}</span>
      </div>
    </div>
  );
}

// ── Tenant Context Selector ───────────────────────────────────────────────────
function TenantContextBar({ tenants, selected, onChange, isAr }) {
  const { universities = [], colleges = [] } = tenants;
  const allTenants = [
    { id: 'ALL', label: isAr ? 'كافة الجامعات والكليات' : 'All Tenants (Global)', type: 'ALL', icon: '🌐' },
    ...universities.map(u => ({ id: `UNI_${u.id}`, label: u.name, type: 'UNIVERSITY', universityId: u.id, icon: '🏛️' })),
    ...colleges.map(c => ({
      id: `COL_${c.id}`,
      label: `${c.name}${c.university ? ` — ${c.university.name}` : ''}`,
      type: 'COLLEGE', collegeId: c.id, universityId: c.universityId, icon: '🏫'
    })),
  ];

  const current = allTenants.find(t => t.id === selected?.id) || allTenants[0];

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider hidden md:block">
        {isAr ? 'السياق:' : 'Context:'}
      </span>
      <div className="relative">
        <select
          value={current.id}
          onChange={e => {
            const found = allTenants.find(t => t.id === e.target.value);
            onChange(found || allTenants[0]);
          }}
          className="appearance-none bg-black/60 border border-white/10 hover:border-[var(--accent)]/40 text-white rounded-xl pl-7 pr-8 py-2 text-xs font-bold focus:outline-none focus:border-[var(--accent)]/60 transition cursor-pointer min-w-[200px] md:min-w-[260px] backdrop-blur-md"
        >
          {allTenants.map(t => (
            <option key={t.id} value={t.id}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
        <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-xs">{current.icon}</span>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/30 text-[10px]">▼</span>
      </div>
      {current.type !== 'ALL' && (
        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
          current.type === 'UNIVERSITY'
            ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
            : 'text-[var(--accent)] bg-[var(--accent)]/10 border-[var(--accent)]/20'
        }`}>
          {current.type}
        </span>
      )}
    </div>
  );
}

// ── Main DevPortal ────────────────────────────────────────────────────────────
export default function DevPortal() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const token = localStorage.getItem('manar_token');

  // Sidebar
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeTab, setActiveTab]             = useState('telemetry');

  // Global context (multi-tenant selector)
  const [tenantContext, setTenantContext] = useState({ id: 'ALL', type: 'ALL', label: 'All Tenants' });
  const [allTenants, setAllTenants]       = useState({ universities: [], colleges: [] });

  // Live Telemetry
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading]     = useState(true);

  // ── Fetch tenant list for dropdown ──
  const fetchTenants = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/dev/tenant-configs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setAllTenants({
          universities: res.data.data.universities || [],
          colleges:     res.data.data.colleges     || [],
        });
      }
    } catch (_) {}
  };

  // ── Fetch telemetry ──
  const fetchTelemetry = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/dev/dashboard-telemetry`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) setTelemetry(res.data.data);
    } catch (err) {
      console.error('Telemetry fetch failed:', err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    fetchTenants();
    const interval = setInterval(() => fetchTelemetry(true), 8000);
    return () => clearInterval(interval);
  }, []);

  // ── Impersonation handler ──
  const handleImpersonateStart = (impersonateToken, targetUser) => {
    localStorage.setItem('manar_super_admin_token', token);
    localStorage.setItem('manar_super_admin_user', localStorage.getItem('manar_user'));
    localStorage.setItem('manar_token', impersonateToken);
    
    // Construct full user object matching standard login user object
    const role = targetUser.role || targetUser.type || 'STUDENT';
    const userToSave = {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: role,
      googleId: targetUser.googleId || 'impersonated',
      groupId: targetUser.groupId,
      collegeId: targetUser.collegeId,
      isRepresentative: targetUser.isRepresentative,
      universityId: targetUser.universityId,
      collegeName: targetUser.collegeName,
      universityName: targetUser.universityName,
      universityLogo: targetUser.universityLogo,
      themeColor: targetUser.themeColor
    };
    
    localStorage.setItem('manar_user', JSON.stringify(userToSave));
    
    if (role === 'STUDENT') {
      localStorage.setItem('student_profile', JSON.stringify({
        name: targetUser.name,
        email: targetUser.email,
        department: targetUser.groupName || targetUser.major?.name || '',
        groupId: targetUser.groupId
      }));
      if (userToSave.isRepresentative) {
        window.location.href = '/student/representative';
      } else {
        window.location.href = '/student/home';
      }
    } else if (role === 'LECTURER') {
      window.location.href = '/lecturer/home';
    } else {
      window.location.href = '/admin/overview';
    }
  };

  // ── Build tenantFilter prop from context ──
  const tenantFilter = (() => {
    if (tenantContext.type === 'ALL')        return {};
    if (tenantContext.type === 'UNIVERSITY') return { universityId: tenantContext.universityId };
    if (tenantContext.type === 'COLLEGE')    return { collegeId: tenantContext.collegeId, universityId: tenantContext.universityId };
    return {};
  })();

  const menuItems = [
    { id: 'telemetry',     labelAr: 'لوحة التحكم والقياس',    labelEn: 'Overview & Telemetry', icon: '📊' },
    { id: 'chart',         labelAr: 'رسم النشاط الحي 24h',    labelEn: 'Live Activity Chart',  icon: '📈' },
    { id: 'traffic',       labelAr: 'مراقبة الجلسات الحية',   labelEn: 'Live Traffic & Kicks',  icon: '👥' },
    { id: 'inspector',     labelAr: 'رادار الطلبات الحية',    labelEn: 'API Request Inspector', icon: '🔌' },
    { id: 'devstats',      labelAr: 'إحصائيات الأجهزة',       labelEn: 'Device Stats & OS',     icon: '📱' },
    { id: 'audit',         labelAr: 'سجل التدقيق البصري',     labelEn: 'Audit Log Viewer',      icon: '📋' },
    { id: 'branches',      labelAr: 'تحكم الشعب العميق',      labelEn: 'Deep Branch Control',   icon: '🌳' },
    { id: 'alerts',        labelAr: 'بث التنبيهات الفورية',   labelEn: 'Universal Alerts',      icon: '📢' },
    { id: 'crud',          labelAr: 'التحكم الشامل بالكيانات', labelEn: 'Master Entity CRUD',    icon: '⚙️' },
    { id: 'branding',      labelAr: 'المستأجرين والعلامة',    labelEn: 'Tenants & Branding',    icon: '🏛️' },
    { id: 'db-map',        labelAr: 'خريطة الربط وقواعد البيانات', labelEn: 'Database Integration Map', icon: '🗺️' },
    { id: 'impersonation', labelAr: 'محاكاة الحسابات',        labelEn: 'God Impersonator',      icon: '🚀' },
    { id: 'insights',      labelAr: 'مستشار التنبؤ الذكي',    labelEn: 'AI Operations Insights', icon: '🤖' },
    { id: 'patcher',       labelAr: 'الشفاء الذاتي بـ AI',     labelEn: 'AI Self-Healing Patcher', icon: '🩺' },
    { id: 'terminal',      labelAr: 'غرفة استعلام SQL',       labelEn: 'SQL Query Terminal',     icon: '💻' },
    { id: 'backup',        labelAr: 'النسخ الاحتياطي',        labelEn: 'Backup Manager',         icon: '💾' },
    { id: 'engine',        labelAr: 'غرفة المحرك والتعدين',   labelEn: 'System Engine Room',    icon: '🔒' },
  ];

  const dbLatency = telemetry?.server?.dbLatency ?? 0;
  const onlineCount = telemetry?.onlineUsers?.length ?? 0;
  const uptimeHrs = telemetry?.server?.uptime ? Math.round(telemetry.server.uptime / 3600) : 0;
  const ramMb = telemetry?.server?.memory?.rss ? Math.round(telemetry.server.memory.rss / (1024 * 1024)) : 0;

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--bg-primary)] text-slate-100 flex overflow-hidden font-sans">

      {/* ── Collapsible Cyber Sidebar ── */}
      <motion.div
        animate={{ width: sidebarExpanded ? 260 : 70 }}
        className="bg-black/40 border-r border-white/5 backdrop-blur-xl min-h-screen flex flex-col shrink-0 transition-all duration-300 relative z-30"
      >
        <button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="absolute top-4 -left-3 w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-750 flex items-center justify-center text-xs text-white shadow-xl cursor-pointer z-40"
        >
          {sidebarExpanded ? '‹' : '›'}
        </button>

        {/* Brand */}
        <div className="p-6 border-b border-white/5 flex items-center gap-3 overflow-hidden">
          <span className="text-xl shrink-0">🛡️</span>
          {sidebarExpanded && (
            <motion.span
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="font-black text-xs tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-teal-400 whitespace-nowrap"
            >
              God Command Center
            </motion.span>
          )}
        </div>

        {/* Tenant badge in sidebar */}
        {sidebarExpanded && tenantContext.type !== 'ALL' && (
          <div className="mx-3 mt-3 px-3 py-2 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl">
            <span className="text-[9px] text-[var(--accent)] font-bold uppercase block truncate">
              {tenantContext.icon} {tenantContext.label}
            </span>
          </div>
        )}

        {/* Nav */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${
                activeTab === item.id
                  ? 'bg-gradient-to-r from-[var(--accent)]/20 to-[var(--accent)]/5 border border-[var(--accent)]/30 text-white shadow-lg shadow-[var(--accent)]/5'
                  : 'hover:bg-white/5 text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <span className="text-sm shrink-0">{item.icon}</span>
              {sidebarExpanded && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="truncate">
                  {isAr ? item.labelAr : item.labelEn}
                </motion.span>
              )}
              {activeTab === item.id && sidebarExpanded && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 flex items-center justify-between overflow-hidden">
          {sidebarExpanded ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-ping shrink-0" />
              <span className="text-[10px] text-[var(--accent)] font-bold uppercase tracking-wider">Watchtower Active</span>
            </div>
          ) : (
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] mx-auto" />
          )}
        </div>
      </motion.div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* ═══════════════════════════════════════════════════════════════════
            HEADER: Title + Multi-Tenant Context Selector + Live Stats
        ════════════════════════════════════════════════════════════════════ */}
        <div className="bg-black/20 border-b border-white/5 backdrop-blur-md px-6 py-4 sticky top-0 z-20">

          {/* Row 1: Title + Context Selector */}
          <div className="flex flex-wrap justify-between items-start gap-4 mb-3">
            <div>
              <h1 className="text-base font-black text-white flex items-center gap-2">
                {isAr ? 'مركز التحكم والتشخيص' : 'Enterprise COMMAND Center'}
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 font-mono">v3.5.0</span>
              </h1>
              <p className="text-[11px] text-white/55 mt-0.5">
                {isAr ? 'مراقبة حية · إدارة المستأجرين · سجل التدقيق · محاكاة الصلاحيات' : 'Live telemetry · Multi-tenant control · Audit trail · Session impersonation'}
              </p>
            </div>

            {/* 🌟 Multi-Tenant Context Selector */}
            <TenantContextBar
              tenants={allTenants}
              selected={tenantContext}
              onChange={setTenantContext}
              isAr={isAr}
            />
          </div>

          {/* Row 2: Live stat mini-cards */}
          <div className="flex flex-wrap gap-2">
            <StatCard
              label={isAr ? 'زمن استجابة DB' : 'DB Latency'}
              value={`${dbLatency} ms`}
              color={dbLatency < 50 ? 'text-emerald-400' : dbLatency < 150 ? 'text-amber-400' : 'text-red-400'}
              pulse={true}
            />
            <StatCard
              label={isAr ? 'مستخدمون نشطون' : 'Online Users'}
              value={onlineCount}
              icon="👥"
              color="text-sky-400"
            />
            <StatCard
              label={isAr ? 'وقت التشغيل' : 'Server Uptime'}
              value={`${uptimeHrs}h`}
              icon="⏱️"
              color="text-indigo-400"
            />
            <StatCard
              label={isAr ? 'ذاكرة RAM' : 'RAM Usage'}
              value={`${ramMb} MB`}
              icon="💾"
              color={ramMb > 400 ? 'text-red-400' : 'text-purple-400'}
            />
            <StatCard
              label={isAr ? 'إجمالي الطلاب' : 'Total Students'}
              value={telemetry?.counts?.students ?? 0}
              icon="👨‍🎓"
              color="text-white"
            />
            {/* Context-aware badge */}
            {tenantContext.type !== 'ALL' && (
              <div className="px-3 py-2 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-xl flex items-center gap-2">
                <span className="text-[9px] font-bold text-[var(--accent)] uppercase">CONTEXT FILTER ACTIVE</span>
                <button
                  onClick={() => setTenantContext({ id: 'ALL', type: 'ALL', label: 'All Tenants' })}
                  className="text-[9px] text-white/50 hover:text-white transition ml-1"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="p-6 max-w-[1600px] w-full mx-auto space-y-6 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${tenantContext.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >

              {/* ── Tab: Overview & Telemetry ── */}
              {activeTab === 'telemetry' && (
                <div className="space-y-6">
                  {/* Top 4 dials */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      {
                        label: isAr ? 'صحة قاعدة البيانات' : 'DB Health',
                        value: dbLatency < 50 ? 'EXCELLENT' : dbLatency < 150 ? 'NORMAL' : 'DEGRADED',
                        color: dbLatency < 50 ? 'text-emerald-400' : dbLatency < 150 ? 'text-amber-400' : 'text-red-400',
                        icon: '⚡',
                        sub: `${dbLatency}ms ping`
                      },
                      {
                        label: isAr ? 'وقت تشغيل الخادم' : 'Server Uptime',
                        value: `${uptimeHrs} hrs`,
                        color: 'text-sky-400', icon: '⏱️',
                        sub: isAr ? 'استقرار متواصل' : 'Continuous stability'
                      },
                      {
                        label: isAr ? 'إجمالي الطلاب' : 'Total Students',
                        value: telemetry?.counts?.students ?? 0,
                        color: 'text-indigo-400', icon: '👨‍🎓',
                        sub: isAr ? 'كافة المستأجرين' : 'Cross all tenants'
                      },
                      {
                        label: isAr ? 'استهلاك الذاكرة' : 'Node RAM',
                        value: `${ramMb} MB`,
                        color: ramMb > 400 ? 'text-red-400' : 'text-purple-400', icon: '💾',
                        sub: 'RSS heap allocated'
                      },
                    ].map((d, i) => (
                      <div key={i} className="bg-black/40 border border-white/5 p-5 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-[9px] text-white/40 font-bold block uppercase tracking-wider">{d.label}</span>
                          <h3 className={`text-lg font-black font-mono mt-1 ${d.color}`}>{d.value}</h3>
                          <span className="text-[10px] text-white/40 mt-1 block">{d.sub}</span>
                        </div>
                        <span className="text-2xl opacity-60">{d.icon}</span>
                      </div>
                    ))}
                  </div>

                  {/* Entity counts + server specs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 bg-black/40 border border-white/5 p-6 rounded-2xl">
                      <h4 className="text-xs font-bold text-white mb-4 uppercase tracking-wider">
                        {isAr ? 'إحصائيات الكيانات الفيدرالية' : 'Federated Entities Status'}
                      </h4>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-xs font-mono">
                        {[
                          { label: 'Universities', value: telemetry?.counts?.universities ?? 0 },
                          { label: 'Colleges',     value: telemetry?.counts?.colleges ?? 0 },
                          { label: 'Lecturers',    value: telemetry?.counts?.lecturers ?? 0 },
                          { label: 'Rooms',        value: telemetry?.counts?.rooms ?? 0 },
                          { label: 'Schedules',    value: telemetry?.counts?.schedules ?? 0 },
                          { label: 'Reschedules',  value: telemetry?.counts?.rescheduleRequests ?? 0 },
                        ].map(e => (
                          <div key={e.label} className="p-3 bg-black/50 border border-white/5 rounded-xl text-center">
                            <span className="text-white/40 block text-[9px] uppercase mb-1">{e.label}</span>
                            <span className="text-white font-bold text-base">{e.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-black/40 border border-white/5 p-6 rounded-2xl">
                      <h4 className="text-xs font-bold text-white mb-4 uppercase tracking-wider">
                        {isAr ? 'مواصفات الخادم' : 'Server Specs'}
                      </h4>
                      <div className="space-y-2.5 text-xs font-mono">
                        {[
                          { k: 'PLATFORM',    v: telemetry?.server?.platform ?? '...' },
                          { k: 'ARCH',        v: telemetry?.server?.arch ?? '...' },
                          { k: 'NODE',        v: telemetry?.server?.nodeVersion ?? '...' },
                          { k: 'ENV',         v: 'PRODUCTION', color: 'text-[var(--accent)]' },
                        ].map(s => (
                          <div key={s.k} className="flex justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                            <span className="text-white/40">{s.k}:</span>
                            <span className={s.color || 'text-white font-bold'}>{s.v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: Live Activity Chart ── */}
              {activeTab === 'chart' && (
                <LiveTelemetryChart API_URL={API_URL} token={token} isAr={isAr} />
              )}

              {/* ── Tab: Live Traffic ── */}
              {activeTab === 'traffic' && (
                <SessionLogsGrid API_URL={API_URL} token={token} isAr={isAr} tenantFilter={tenantFilter} />
              )}

              {/* ── Tab: Audit Log ── */}
              {activeTab === 'audit' && (
                <AuditLogViewer API_URL={API_URL} token={token} isAr={isAr} tenantFilter={tenantFilter} />
              )}

              {/* ── Tab: Deep Branch Control ── */}
              {activeTab === 'branches' && (
                <DeepBranchManager API_URL={API_URL} token={token} isAr={isAr} tenantFilter={tenantFilter} />
              )}

              {/* ── Tab: Alerts ── */}
              {activeTab === 'alerts' && (
                <GlobalNotificationsGrid API_URL={API_URL} token={token} isAr={isAr} />
              )}

              {/* ── Tab: Master CRUD ── */}
              {activeTab === 'crud' && (
                <MasterDataManager API_URL={API_URL} token={token} isAr={isAr} />
              )}

              {/* ── Tab: Tenants ── */}
              {activeTab === 'branding' && (
                <TenantsManager API_URL={API_URL} token={token} isAr={isAr} />
              )}

              {/* ── Tab: Database Integration Map ── */}
              {activeTab === 'db-map' && (
                <DbIntegrationMap API_URL={API_URL} token={token} isAr={isAr} />
              )}

              {/* ── Tab: Impersonation ── */}
              {activeTab === 'impersonation' && (
                <ImpersonatorDirectory
                  API_URL={API_URL}
                  token={token}
                  onImpersonate={handleImpersonateStart}
                  isAr={isAr}
                />
              )}

              {/* ── Tab: Backup Manager ── */}
              {activeTab === 'backup' && (
                <BackupManager API_URL={API_URL} token={token} isAr={isAr} />
              )}

              {/* ── Tab: Engine Room ── */}
              {activeTab === 'engine' && (
                <EngineRoom
                  API_URL={API_URL}
                  token={token}
                  initialSettings={telemetry?.settings || {}}
                  isAr={isAr}
                />
              )}

              {/* ── Tab: API Inspector ── */}
              {activeTab === 'inspector' && (
                <ApiRequestInspector API_URL={API_URL} token={token} isAr={isAr} />
              )}

              {/* ── Tab: Device Stats ── */}
              {activeTab === 'devstats' && (
                <DeviceStatsPanel API_URL={API_URL} token={token} isAr={isAr} />
              )}

              {/* ── Tab: AI Insights ── */}
              {activeTab === 'insights' && (
                <AIPredictiveInsights API_URL={API_URL} token={token} isAr={isAr} />
              )}

              {/* ── Tab: SQL Terminal ── */}
              {activeTab === 'terminal' && (
                <SqlTerminal API_URL={API_URL} token={token} isAr={isAr} />
              )}

              {/* ── Tab: AI Self-Healing Patcher ── */}
              {activeTab === 'patcher' && (
                <SelfHealingPatcher API_URL={API_URL} token={token} isAr={isAr} />
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
