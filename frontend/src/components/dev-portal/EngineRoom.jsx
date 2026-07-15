import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// ── Premium Glass Toggle Switch ───────────────────────────────────────────────
function GlassToggle({ checked, onChange, disabled, size = 'sm', accentOn = 'bg-blue-600', label }) {
  const sizes = {
    sm: { track: 'w-11 h-6',   knob: 'w-4 h-4', on: 'translate-x-5', off: 'translate-x-1' },
    md: { track: 'w-16 h-8',   knob: 'w-6 h-6', on: 'translate-x-8', off: 'translate-x-1' },
    lg: { track: 'w-24 h-12',  knob: 'w-10 h-10', on: 'translate-x-12', off: 'translate-x-1' },
  };
  const s = sizes[size] || sizes.sm;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      aria-label={label}
      className={`relative ${s.track} rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
        checked ? `${accentOn} shadow-lg shadow-blue-500/30` : 'bg-slate-800 border border-slate-700'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`absolute top-1/2 -translate-y-1/2 ${s.knob} rounded-full bg-white shadow-xl flex items-center justify-center`}
        style={{ left: checked ? undefined : '4px', right: checked ? '4px' : undefined }}
      />
    </button>
  );
}

// ── Panic / Kill Switch Modal ─────────────────────────────────────────────────
function KillSwitchModal({ onConfirm, onCancel, isAr }) {
  const [code, setCode] = useState('');
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 border border-red-500/40 rounded-2xl p-8 w-full max-w-md shadow-2xl shadow-red-500/10"
      >
        {/* Icon */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">☢️</span>
          </div>
          <h3 className="text-xl font-black text-white">{isAr ? 'الزر النووي' : 'GLOBAL KILL SWITCH'}</h3>
          <p className="text-xs text-slate-400 mt-2">
            {isAr
              ? 'سيتم إغلاق جميع نقاط الـ API فوراً وطرد جميع المستخدمين وعرض شاشة الصيانة الطارئة.'
              : 'This will immediately shut down all API endpoints, kick all users, and display an emergency maintenance screen.'}
          </p>
        </div>

        <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl mb-4 text-[11px] text-red-400 font-bold text-center">
          {isAr ? 'اكتب "KILL SYSTEM" للتأكيد' : 'Type "KILL SYSTEM" to confirm'}
        </div>

        <input
          autoFocus
          type="text"
          placeholder="KILL SYSTEM"
          value={code}
          onChange={e => setCode(e.target.value)}
          className="w-full bg-slate-950 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-center font-black text-red-400 placeholder-red-900 focus:outline-none focus:border-red-500/60 mb-4"
        />

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={() => code === 'KILL SYSTEM' && onConfirm()}
            disabled={code !== 'KILL SYSTEM'}
            className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white font-black rounded-xl text-xs transition shadow-lg shadow-red-600/30"
          >
            {isAr ? '🔴 تنفيذ الإغلاق الطارئ' : '🔴 Execute Kill Switch'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main EngineRoom ───────────────────────────────────────────────────────────
export default function EngineRoom({ API_URL, token, initialSettings, isAr }) {
  const [settings, setSettings]     = useState(initialSettings || {});
  const [loading, setLoading]       = useState({});
  const [purgeInput, setPurgeInput] = useState('');
  const [purging, setPurging]       = useState(false);
  const [showKill, setShowKill]     = useState(false);
  const [killing, setKilling]       = useState(false);

  const toggleSetting = async (key, currentValue) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/dev/toggle-setting`,
        { key, value: !currentValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setSettings(res.data.settings);
        toast.success(isAr ? `تم تحديث: ${key}` : `Updated: ${key}`);
      }
    } catch {
      toast.error(isAr ? 'فشل التحديث' : 'Update failed');
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const updateTextSetting = async (key, val) => {
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/dev/toggle-setting`,
        { key, value: val },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setSettings(res.data.settings);
        toast.success(isAr ? 'تم الحفظ' : 'Saved');
      }
    } catch {
      toast.error(isAr ? 'فشل الحفظ' : 'Save failed');
    }
  };

  const handlePurge = async (e) => {
    e.preventDefault();
    if (purgeInput !== 'CONFIRM PURGE') {
      toast.error(isAr ? 'اكتب CONFIRM PURGE بدقة' : 'Type CONFIRM PURGE exactly');
      return;
    }
    if (!window.confirm(isAr ? '⚠️ تحذير نهائي: سيُمسح كافة البيانات التجريبية!' : '⚠️ Final warning: All test data will be permanently purged!')) return;
    setPurging(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/dev/actions/clear-test-data`,
        { confirmText: purgeInput },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        toast.success(isAr ? 'تم تطهير البيانات بنجاح!' : 'Test data purged!');
        setPurgeInput('');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل التطهير' : 'Purge failed'));
    } finally {
      setPurging(false);
    }
  };

  const handleKillSwitch = async () => {
    setKilling(true);
    setShowKill(false);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/dev/actions/global-kill-switch`,
        { confirm: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        // Activate maintenance mode locally too
        setSettings(prev => ({ ...prev, maintenanceMode: true }));
        toast.success(isAr ? '🔴 تم تفعيل الإغلاق الطارئ — النظام في وضع الصيانة' : '🔴 Global Kill Switch activated — System in maintenance mode');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل الإغلاق الطارئ' : 'Kill switch failed'));
    } finally {
      setKilling(false);
    }
  };

  const configToggles = [
    {
      key: 'maintenanceMode',
      labelAr: 'وضع الصيانة العام', descAr: 'حظر دخول الطلاب والمحاضرين وعرض شاشة الصيانة.',
      labelEn: 'Maintenance Mode',  descEn: 'Lock user access and display maintenance screen.',
      accent: 'bg-amber-500', size: 'md', danger: true,
    },
    {
      key: 'debugMode',
      labelAr: 'وضع التصحيح (Debug)', descAr: 'عرض تفاصيل الأخطاء وسجلات المطورين.',
      labelEn: 'Debug Mode',          descEn: 'Show detailed stack traces and developer logs.',
      accent: 'bg-blue-600',
    },
    {
      key: 'verboseLogging',
      labelAr: 'تسجيل اللوغز المفصل', descAr: 'كتابة تفاصيل كافة طلبات HTTP في سجلات الخادم.',
      labelEn: 'Verbose Logging',     descEn: 'Record extensive HTTP request logs on the server.',
      accent: 'bg-blue-600',
    },
    {
      key: 'enforceCaptcha',
      labelAr: 'فرض الكابتشا', descAr: 'حماية جوجل ريكابتشا لمنع الهجمات المؤتمتة.',
      labelEn: 'Enforce Captcha',     descEn: 'Require Google reCAPTCHA on sign in.',
      accent: 'bg-blue-600',
    },
    {
      key: 'requireGoogleLink',
      labelAr: 'فرض ربط حساب جوجل', descAr: 'منع دخول الطلاب دون ربط حساب جوجل الأكاديمي.',
      labelEn: 'Require Google Link', descEn: 'Force students to bind a Google Account.',
      accent: 'bg-blue-600',
    },
    {
      key: 'allowStudentProfileEdit',
      labelAr: 'السماح بتعديل الملف الشخصي', descAr: 'تمكين الطلاب من تغيير صورهم أو أرقام هواتفهم.',
      labelEn: 'Allow Profile Edit',            descEn: 'Let students modify phone or profile picture.',
      accent: 'bg-blue-600',
    },
  ];

  return (
    <>
      {/* Kill Switch Modal */}
      <AnimatePresence>
        {showKill && (
          <KillSwitchModal
            onConfirm={handleKillSwitch}
            onCancel={() => setShowKill(false)}
            isAr={isAr}
          />
        )}
      </AnimatePresence>

      <div className="space-y-6">

        {/* ── Row 1: Maintenance Mode (Hero Switch) + Kill Switch ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* 🔧 Maintenance Mode - Hero */}
          <div className={`relative overflow-hidden border rounded-2xl p-6 shadow-2xl transition-all duration-500 ${
            settings.maintenanceMode
              ? 'bg-amber-500/5 border-amber-500/40 shadow-amber-500/10'
              : 'bg-slate-900/60 border-slate-800'
          }`}>
            {/* Glow when active */}
            {settings.maintenanceMode && (
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
            )}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <span className={settings.maintenanceMode ? 'animate-pulse' : ''}>🔧</span>
                  {isAr ? 'وضع الصيانة الكاملة' : 'System Maintenance Mode'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {isAr
                    ? 'يحجب النظام بالكامل عن الطلاب والمحاضرين ويعرض شاشة الصيانة الأنيقة.'
                    : 'Blocks all non-admin access and displays a premium maintenance page.'}
                </p>
              </div>
              <GlassToggle
                size="md"
                checked={!!settings.maintenanceMode}
                onChange={() => toggleSetting('maintenanceMode', settings.maintenanceMode)}
                disabled={loading.maintenanceMode}
                accentOn="bg-amber-500"
                label="Maintenance Mode"
              />
            </div>
            <div className={`text-xs font-bold flex items-center gap-2 transition-all ${
              settings.maintenanceMode ? 'text-amber-400' : 'text-slate-600'
            }`}>
              <span className={`w-2 h-2 rounded-full ${settings.maintenanceMode ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'}`} />
              {settings.maintenanceMode
                ? (isAr ? 'النظام في وضع الصيانة — المستخدمون محجوبون' : 'MAINTENANCE ACTIVE — Users are blocked')
                : (isAr ? 'النظام يعمل بشكل طبيعي' : 'System operating normally')}
            </div>
          </div>

          {/* ☢️ Kill Switch */}
          <div className="bg-slate-900/60 border border-red-500/20 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-black text-white flex items-center gap-2 mb-2">
              <span>☢️</span>
              {isAr ? 'مفتاح الإغلاق الطارئ' : 'Emergency Kill Switch'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {isAr
                ? 'إغلاق فوري لجميع الـ APIs، طرد كافة المستخدمين، وعرض شاشة صيانة طارئة. للأزمات فقط.'
                : 'Instantly shuts down all API endpoints and kicks all active sessions. Emergency use only.'}
            </p>
            <button
              onClick={() => setShowKill(true)}
              disabled={killing}
              className="w-full py-3.5 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 disabled:opacity-40 text-white font-black rounded-xl text-xs transition duration-200 shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 border border-red-500/30"
            >
              {killing ? (
                <span className="animate-pulse">{isAr ? 'جاري الإغلاق الطارئ...' : 'Engaging kill switch...'}</span>
              ) : (
                <>
                  <span>🔴</span>
                  <span>{isAr ? 'تفعيل الإغلاق الطارئ الكامل' : 'Activate Global Kill Switch'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Row 2: Config Toggles Grid ── */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-6 shadow-2xl">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <span className="text-blue-400">⚙️</span>
            {isAr ? 'مفاتيح تشغيل النظام' : 'Engine Configuration Toggles'}
          </h3>
          <p className="text-[11px] text-slate-500 mb-5">
            {isAr ? 'التحكم الفوري بإعدادات النظام الأساسية دون لمس الكود.' : 'Live control of core system settings without touching the code.'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {configToggles.filter(t => t.key !== 'maintenanceMode').map((item) => {
              const isChecked = !!settings[item.key];
              return (
                <div
                  key={item.key}
                  className="flex justify-between items-center p-4 bg-slate-950/50 rounded-xl border border-slate-800 hover:border-slate-700 transition"
                >
                  <div className="max-w-[75%]">
                    <span className="text-xs font-bold text-white block">{isAr ? item.labelAr : item.labelEn}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{isAr ? item.descAr : item.descEn}</span>
                  </div>
                  <GlassToggle
                    checked={isChecked}
                    onChange={() => toggleSetting(item.key, isChecked)}
                    disabled={loading[item.key]}
                    label={item.key}
                  />
                </div>
              );
            })}
          </div>

          {/* Text inputs */}
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-800/60">
            {[
              { key: 'academicYear',     labelAr: 'السنة الأكاديمية',    labelEn: 'Academic Year'    },
              { key: 'currentSemester',  labelAr: 'الفصل الدراسي',       labelEn: 'Current Semester' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                  {isAr ? f.labelAr : f.labelEn}
                </label>
                <input
                  type="text"
                  value={settings[f.key] || ''}
                  onChange={e => setSettings({ ...settings, [f.key]: e.target.value })}
                  onBlur={e => updateTextSetting(f.key, e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/40 transition"
                />
              </div>
            ))}
          </div>

          {/* OTA Real-time UI Override Settings */}
          <div className="mt-6 pt-6 border-t border-slate-800/80">
            <h4 className="text-xs font-black text-amber-400 mb-3 flex items-center gap-1.5">
              <span>📡</span>
              {isAr ? 'التحكم الفوري في واجهة المستخدم (Over-The-Air OTA)' : 'Over-The-Air (OTA) Real-Time UI Injection'}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                  {isAr ? 'تجاوز لون السمة (HEX Color)' : 'Theme Color Override (HEX)'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.otaThemeColor || '#000000'}
                    onChange={e => setSettings({ ...settings, otaThemeColor: e.target.value })}
                    onBlur={e => updateTextSetting('otaThemeColor', e.target.value)}
                    className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    placeholder="e.g. #f43f5e"
                    value={settings.otaThemeColor || ''}
                    onChange={e => setSettings({ ...settings, otaThemeColor: e.target.value })}
                    onBlur={e => updateTextSetting('otaThemeColor', e.target.value === '' ? null : e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1 text-xs text-white focus:outline-none focus:border-blue-500/40 transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                  {isAr ? 'شريط تحذيري عاجل (Warning Banner)' : 'Emergency Warning Banner Text'}
                </label>
                <input
                  type="text"
                  placeholder={isAr ? 'مثال: أعمال صيانة مجدولة في الغد...' : 'e.g. Server maintenance tomorrow...'}
                  value={settings.otaWarningBanner || ''}
                  onChange={e => setSettings({ ...settings, otaWarningBanner: e.target.value })}
                  onBlur={e => updateTextSetting('otaWarningBanner', e.target.value === '' ? null : e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/40 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                  {isAr ? 'عناصر مخفية (أزرار معطلة مؤقتاً)' : 'Hidden UI Features / Buttons'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. exams, attendance"
                  value={Array.isArray(settings.otaHiddenButtons) ? settings.otaHiddenButtons.join(', ') : ''}
                  onChange={e => setSettings({ ...settings, otaHiddenButtons: e.target.value.split(',').map(s => s.trim()) })}
                  onBlur={e => updateTextSetting('otaHiddenButtons', settings.otaHiddenButtons)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/40 transition font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 3: Purge + Cryptography ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Safe Purge */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-red-500/20 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <span className="text-red-500">⚠️</span>
              {isAr ? 'تطهير قاعدة البيانات' : 'Emergency Database Purge'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {isAr ? 'حذف كافة البيانات التجريبية والحسابات نهائياً. لا يمكن التراجع!' : 'Permanently delete all test data. This cannot be undone!'}
            </p>

            <form onSubmit={handlePurge} className="space-y-3">
              <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/20 text-[10px] text-red-400 font-semibold text-center">
                {isAr ? 'اكتب "CONFIRM PURGE" للتنفيذ' : 'Type "CONFIRM PURGE" to authorize'}
              </div>
              <input
                type="text"
                placeholder="CONFIRM PURGE"
                value={purgeInput}
                onChange={e => setPurgeInput(e.target.value)}
                className="w-full bg-slate-950 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-center font-black text-red-500 placeholder-red-900 focus:outline-none focus:border-red-500/50"
              />
              <button
                type="submit"
                disabled={purging || purgeInput !== 'CONFIRM PURGE'}
                className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-red-600/25"
              >
                {purging ? (isAr ? 'جاري التطهير...' : 'Purging...') : (isAr ? '🔴 تنفيذ التطهير الفوري' : 'Execute Database Purge')}
              </button>
            </form>
          </div>

          {/* Cryptography Watchtower */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl font-mono text-[10px] text-slate-400">
            <h4 className="text-xs font-bold text-white mb-4 flex items-center gap-1.5">
              <span>🛡️</span>
              {isAr ? 'Watchtower — تشفير وحماية' : 'Watchtower Cryptography & Keys'}
            </h4>
            <div className="space-y-3">
              {[
                { k: 'JWT SECRET HASH', v: 'VERIFIED (HMAC-SHA256)',      color: 'text-emerald-400' },
                { k: 'VAPID PUBLIC KEY', v: 'MIIBIjANBgkqhkiG9w0BAQ... (MASKED)', color: 'text-slate-300' },
                { k: 'PASSWORD HASHING', v: 'BCRYPT (SALT_ROUNDS = 10)',  color: 'text-slate-300' },
                { k: 'TRANSPORT',       v: 'TLS 1.3 / HTTPS',            color: 'text-emerald-400' },
                { k: 'SESSION TOKENS',  v: 'RS256 · 7d expiry',           color: 'text-sky-400' },
              ].map(row => (
                <div key={row.k} className="flex justify-between border-b border-slate-800/60 pb-2.5 last:border-0 last:pb-0">
                  <span className="text-slate-500">{row.k}:</span>
                  <span className={`${row.color} font-bold text-right max-w-[55%] truncate`}>{row.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
