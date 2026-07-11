import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from './config';
import { useTranslation } from 'react-i18next';
import DevSignature from './DevSignature';
import { scheduleOfflineNotifications } from './utils/localNotifications';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const DEPARTMENTS = ['Computer Science', 'Information Systems', 'Software Engineering'];
const LEVELS      = ['Level 1', 'Level 2', 'Level 3', 'Level 4'];
const DAYS        = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// ── Framer Motion variants ────────────────────────────────────────────────────
const containerVariants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.05 }
  }
};
const sectionVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcCompletion(profile) {
  const fields = [
    profile.name,
    profile.email,
    profile.phone,
    profile.idPhotoUrl,
    profile.department,
    profile.level,
    profile.groupId,
  ];
  const filled = fields.filter(f => f && String(f).trim() !== '' && f !== 0).length;
  return Math.round((filled / fields.length) * 100);
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="space-y-1.5 text-right">
      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] block">{label}</label>
      {children}
    </div>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────
function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] gap-3">
      <div className="min-w-0 text-right">
        <span className="font-bold block text-[var(--text-primary)] text-xs">{label}</span>
        {desc && <span className="text-[10px] text-[var(--text-secondary)] block mt-0.5">{desc}</span>}
      </div>
      {/* Custom toggle switch */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full border transition-all duration-300 ${
          checked
            ? 'bg-[var(--accent)] border-[var(--accent)]'
            : 'bg-white/10 border-white/10'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform duration-300 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function UserSettings({ onClose }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  // ── Profile state ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    id: null, name: '', email: '', phone: '', idPhotoUrl: '',
    department: 'Software Engineering', level: 'Level 3', groupId: 1,
  });
  const [groups, setGroups]     = useState([]);
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Accordion state
  const [activeSection, setActiveSection] = useState('profile'); // 'profile' | 'academic' | 'security' | 'notifications'
  const toggleSection = (name) => {
    setActiveSection(prev => prev === name ? null : name);
  };

  // ── Effects ────────────────────────────────────────────────────────────────
  // Load profile + groups
  useEffect(() => {
    // 1) Hydrate from localStorage immediately
    const init = { id: null, name: '', email: '', phone: '', idPhotoUrl: '', department: 'Software Engineering', level: 'Level 3', groupId: 1, isEmailVerified: true, isPhoneVerified: true };
    const saved = localStorage.getItem('student_profile');
    if (saved) {
      try { Object.assign(init, JSON.parse(saved)); } catch {}
    } else {
      const userJson = localStorage.getItem('manar_user');
      if (userJson) {
        try {
          const u = JSON.parse(userJson);
          init.id    = u.id    || null;
          init.name  = u.name  || '';
          init.email = u.email || '';
          init.phone = u.phone || '';
          init.idPhotoUrl = u.idPhotoUrl || '';
          init.groupId    = u.groupId || 1;
          init.isEmailVerified = u.isEmailVerified !== undefined ? u.isEmailVerified : true;
          init.isPhoneVerified = u.isPhoneVerified !== undefined ? u.isPhoneVerified : true;
        } catch {}
      }
    }
    setProfile(init);

    // 2) Fetch fresh from API
    const token = localStorage.getItem('manar_token');
    Promise.all([
      axios.get(`${API_URL}/api/student/settings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }).catch(() => null),
      axios.get(`${API_URL}/api/groups`).catch(() => null),
    ]).then(([profileRes, groupsRes]) => {
      if (profileRes?.data?.success) {
        const s = profileRes.data.data;
        const fresh = {
          id:         s.id          || init.id,
          name:       s.name        || init.name,
          email:      s.email       || init.email,
          phone:      s.phone       || init.phone,
          idPhotoUrl: s.idPhotoUrl  || init.idPhotoUrl,
          department: s.majorName   || s.departmentName || init.department,
          level:      s.levelName   || init.level,
          groupId:    s.groupId     || init.groupId,
          isEmailVerified: s.isEmailVerified !== undefined ? s.isEmailVerified : true,
          isPhoneVerified: s.isPhoneVerified !== undefined ? s.isPhoneVerified : true,
        };
        setProfile(fresh);
        localStorage.setItem('student_profile', JSON.stringify(fresh));
      }
      if (groupsRes?.data?.success) setGroups(groupsRes.data.data);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Notification toggles ────────────────────────────────────────────────────
  const [toggles, setToggles] = useState(() => {
    const saved = localStorage.getItem('student_alert_toggles');
    return saved ? JSON.parse(saved) : { push: true, email: false, sms: true, preAlertTime: '15' };
  });

  const completion = calcCompletion(profile);
  const completionGlow = completion === 100
    ? 'shadow-[0_0_20px_var(--accent-glow)] border-[var(--accent-glow)]'
    : '';

  // Persist notification toggles
  useEffect(() => {
    localStorage.setItem('student_alert_toggles', JSON.stringify(toggles));
    const cached = localStorage.getItem('cached_student_schedules');
    if (cached) {
      scheduleOfflineNotifications(JSON.parse(cached), isAr);
    }
  }, [toggles, isAr]);

  // ── Save profile ───────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const token = localStorage.getItem('manar_token');
    try {
      const res = await axios.put(`${API_URL}/api/student/settings`, {
        name:           profile.name,
        email:          profile.email,
        phone:          profile.phone,
        idPhotoUrl:     profile.idPhotoUrl,
        groupId:        profile.groupId,
        departmentName: profile.department,
        levelName:      profile.level,
        password:       password || undefined,
      }, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

      if (res.data?.success) {
        const d = res.data.data;
        const updated = {
          id:         d.id          || profile.id,
          name:       d.name,
          email:      d.email,
          phone:      d.phone       || '',
          idPhotoUrl: d.idPhotoUrl  || '',
          department: d.majorName   || profile.department,
          level:      d.levelName   || profile.level,
          groupId:    d.groupId,
        };
        localStorage.setItem('student_profile', JSON.stringify(updated));
        const uJson = localStorage.getItem('manar_user');
        if (uJson) {
          try {
            const u = JSON.parse(uJson);
            Object.assign(u, { name: d.name, email: d.email, phone: d.phone, idPhotoUrl: d.idPhotoUrl, groupId: d.groupId });
            localStorage.setItem('manar_user', JSON.stringify(u));
          } catch {}
        }
        setProfile(updated);
        setPassword('');
        toast.success(t('userSettings.savedSuccess'));
      } else throw new Error('API failed');
    } catch (err) {
      const msg = err.response?.data?.error || (isAr ? 'فشل في الحفظ.' : 'Save failed.');
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const deptLabel = (d) => {
    const map = { 'Computer Science': isAr ? 'علوم الحاسوب' : 'Computer Science', 'Information Systems': isAr ? 'نظم المعلومات' : 'Information Systems', 'Software Engineering': isAr ? 'هندسة البرمجيات' : 'Software Engineering' };
    return map[d] || d;
  };

  const handleCheckUpdates = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.update());
      });
    }
    toast.success(isAr ? 'جاري التحقق من وجود تحديثات...' : 'Checking for updates...', { icon: '🔄' });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex-1 w-full bg-transparent p-4 md:p-6 flex flex-col items-center space-y-4 text-[var(--text-primary)]"
    >

      {onClose && (
        <div className="w-full max-w-md flex items-center justify-between pb-3 border-b border-white/5">
          <button
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-black uppercase border border-white/10 hover:border-[var(--accent)] hover:text-black hover:bg-[var(--accent)] bg-white/5 rounded-xl transition-all flex items-center gap-1.5"
          >
            <span>{isAr ? '← عودة' : '← Back'}</span>
          </button>
          <span className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
            {isAr ? 'إعدادات الملف الشخصي' : 'Profile Settings'}
          </span>
        </div>
      )}

      {/* Stunning Digital ID Card */}
      <div className="w-full max-w-md relative overflow-hidden rounded-3xl p-6 shadow-2xl text-white-force border" style={{
        background: 'linear-gradient(135deg, rgba(13, 18, 30, 0.95) 0%, rgba(5, 8, 15, 0.98) 100%)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.15)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}>
        {/* Neon glowing aura backdrop */}
        <div className="absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ backgroundColor: 'var(--accent, #10b981)' }} />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full blur-2xl opacity-15 pointer-events-none" style={{ backgroundColor: 'var(--accent, #10b981)' }} />
        
        {/* Card Border glow */}
        <div className="absolute inset-0 rounded-3xl border border-transparent pointer-events-none opacity-40" style={{
          background: 'linear-gradient(135deg, var(--accent, #10b981) 0%, transparent 60%, var(--accent-glow) 100%) border-box',
          WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude'
        }} />

        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <p className="text-[10px] font-black tracking-widest text-emerald-100-force uppercase opacity-90" style={{ color: 'var(--accent)' }}>
              {isAr ? 'كلية المنار الجامعة' : 'AL-MANAR UNIVERSITY COLLEGE'}
            </p>
            <p className="text-[9px] font-bold text-emerald-200-force opacity-70 tracking-wider">
              {isAr ? 'بطاقة الهوية الرقمية للطلاب' : 'STUDENT DIGITAL IDENTITY CARD'}
            </p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-lg shadow-inner">
            🎓
          </div>
        </div>

        <div className="flex gap-4 items-center">
          {/* Student Initials Badge */}
          <div className="w-16 h-16 rounded-2xl border-2 shadow-md shrink-0 bg-gradient-to-tr flex items-center justify-center font-black text-lg" style={{
            borderColor: 'var(--accent-glow)',
            color: 'var(--accent)',
            background: 'linear-gradient(135deg, var(--accent-dim) 0%, rgba(255,255,255,0.01) 100%)'
          }}>
            {profile.name ? profile.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
          </div>

          {/* Meta details */}
          <div className="min-w-0 flex-1">
            <p className="text-base font-black text-white-force truncate leading-tight">
              {profile.name || (isAr ? 'طالب مستخدم' : 'Student User')}
            </p>
            <p className="text-[11px] font-bold text-emerald-200-force mt-1 truncate" style={{ color: 'var(--accent)' }}>
              {deptLabel(profile.department) || (isAr ? 'هندسة البرمجيات' : 'Software Engineering')}
            </p>
            <p className="text-[10px] text-emerald-200-force opacity-75 mt-0.5 font-bold">
              {profile.level ? profile.level.replace('Level', isAr ? 'المستوى' : 'Level') : (isAr ? 'المستوى 3' : 'Level 3')} • {profile.groupId ? (groups.find(g => g.id === profile.groupId)?.name || `Group ${profile.groupId}`) : 'Group A'}
            </p>
            <p className="text-[9px] text-emerald-200-force opacity-60 mt-1.5 font-mono truncate select-all">
              {profile.email || 'N/A'}
            </p>
          </div>
        </div>

        {/* Barcode drawing */}
        <div className="mt-5 space-y-1.5">
          <div className="bg-white/90 p-2.5 rounded-xl flex flex-col items-center justify-center shadow-inner">
            <div className="flex items-center justify-center gap-[1.5px] w-full">
              {[1, 3, 1, 2, 4, 1, 3, 2, 1, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 1, 4, 1, 2, 1, 3].map((width, idx) => (
                <div
                  key={idx}
                  className="bg-black h-7 shrink-0"
                  style={{ width: `${width}px` }}
                />
              ))}
            </div>
            <p className="text-[8px] font-mono tracking-widest text-slate-800 font-extrabold mt-1">
              *STU-{profile.groupId || '101'}-{profile.id || '26'}*
            </p>
          </div>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Profile Completion Progress
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <motion.div
        variants={sectionVariants}
        className={`w-full max-w-md frosted-panel rounded-2xl p-5 border ${completionGlow} transition-all duration-500`}
      >
        <div className="flex items-center justify-between mb-3 text-right">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              {isAr ? 'اكتمال الملف الشخصي' : 'Profile Completion'}
            </p>
            <p className="text-xs font-bold text-[var(--text-primary)] mt-0.5">
              {completion === 100
                ? (isAr ? '✅ ملفك مكتمل 100%' : '✅ Profile 100% complete')
                : (isAr ? `${completion}% مكتمل — أكمل بياناتك أدناه` : `${completion}% — Fill in remaining fields below`)}
            </p>
          </div>
          <span
            className={`text-2xl font-black tabular-nums ${
              completion === 100 ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            {completion}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completion}%` }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
            className={`h-full rounded-full transition-all ${
              completion === 100
                ? 'bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)]'
                : 'bg-gradient-to-r from-[var(--accent)] to-emerald-400'
            }`}
          />
        </div>

        {/* Field status pills */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {[
            { key: profile.name,        label: isAr ? 'الاسم'   : 'Name' },
            { key: profile.email,       label: isAr ? 'البريد'  : 'Email' },
            { key: profile.phone,       label: isAr ? 'الهاتف'  : 'Phone' },
            { key: profile.idPhotoUrl,  label: isAr ? 'الصورة'  : 'Photo' },
            { key: profile.department,  label: isAr ? 'التخصص'  : 'Major' },
            { key: profile.level,       label: isAr ? 'المستوى' : 'Level' },
            { key: profile.groupId,     label: isAr ? 'الشعبة'  : 'Group' },
          ].map(({ key, label }) => {
            const done = key && String(key).trim() !== '' && key !== 0;
            return (
              <span
                key={label}
                className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                  done
                    ? 'bg-[var(--accent-dim)] border-[var(--accent-glow)] text-[var(--accent)]'
                    : 'bg-red-500/8 border-red-500/20 text-red-400'
                }`}
              >
                {done ? '✓' : '○'} {label}
              </span>
            );
          })}
        </div>
      </motion.div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SETTINGS ACCORDIONS
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="w-full max-w-md space-y-3">

        {/* Accordion 1: Personal Profile Details */}
        <div className="frosted-panel rounded-2xl overflow-hidden border border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => toggleSection('profile')}
            className="w-full flex items-center justify-between px-5 py-4 bg-white/[0.015] hover:bg-white/[0.03] transition-colors text-right"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">👤</span>
              <div className="text-right">
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">{isAr ? 'تعديل الملف الشخصي' : 'Personal Profile'}</h3>
                <p className="text-[9px] text-[var(--text-secondary)] mt-0.5 font-bold">{isAr ? 'تغيير الاسم وصورة إثبات الهوية' : 'Change name and student ID avatar'}</p>
              </div>
            </div>
            <span className="text-xs text-[var(--text-secondary)] font-bold">{activeSection === 'profile' ? '▲' : '▼'}</span>
          </button>
          
          <AnimatePresence initial={false}>
            {activeSection === 'profile' && (
              <motion.div
                key="profile-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="p-5 border-t border-[var(--border-color)] space-y-4 bg-[var(--bg-elevated)]/60">
                  {/* Avatar */}
                  <div className="flex flex-col items-center gap-3 mb-2">
                    <div className="w-20 h-20 rounded-2xl border-2 border-[var(--accent)]/40 shadow-lg bg-gradient-to-tr from-[var(--accent)]/25 to-[var(--accent)]/5 flex items-center justify-center font-black text-xl text-[var(--accent)]">
                      {profile.name ? profile.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
                    </div>
                    <span className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
                      {isAr ? 'رمز الهوية الرقمي' : 'Student Digital Badge'}
                    </span>
                    
                    {/* Verification Status Badge */}
                    <div className="mt-0.5">
                      {true || (profile.isEmailVerified && profile.isPhoneVerified) ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 text-[8px] font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full uppercase tracking-wider">
                          ✅ {isAr ? 'الحساب موثق ومفعل' : 'Verified & Active'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 text-[8px] font-black bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full uppercase tracking-wider animate-pulse">
                          ⚠️ {isAr ? 'قيد الانتظار والتوثيق' : 'Pending Verification'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Identity Verification Document (ID Photo URL / Upload) */}
                  <Field label={isAr ? 'وثيقة إثبات الهوية / البطاقة الجامعية' : 'Identity Document / Student ID Card'}>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={profile.idPhotoUrl || ''}
                          onChange={e => setProfile(p => ({ ...p, idPhotoUrl: e.target.value }))}
                          className="cmd-input flex-1 px-3 text-xs font-semibold"
                          style={{ height: '42px' }}
                          placeholder={isAr ? 'أدخل رابط صورة الهوية أو ارفع ملفاً...' : 'Enter photo URL or upload file...'}
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById('id-photo-file-upload').click()}
                          className="btn-ghost px-3 text-xs font-black shrink-0"
                          style={{ height: '42px' }}
                        >
                          📁 {isAr ? 'رفع ملف' : 'Upload'}
                        </button>
                        <input
                          id="id-photo-file-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setProfile(p => ({ ...p, idPhotoUrl: ev.target.result }));
                                toast.success(isAr ? 'تم تحميل صورة البطاقة!' : 'ID Card Photo uploaded!');
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </div>
                      {profile.idPhotoUrl && (
                        <div className="relative w-full max-w-[200px] h-28 rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--bg-card)] flex items-center justify-center mx-auto">
                          <img src={profile.idPhotoUrl} alt="ID Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setProfile(p => ({ ...p, idPhotoUrl: '' }))}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center text-[10px] font-bold transition-all shadow-md"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </Field>

                  {/* Name */}
                  <Field label={t('userSettings.nameLabel')}>
                    <input
                      type="text"
                      required
                      value={profile.name}
                      onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                      className="cmd-input w-full px-4 font-bold"
                      style={{ height: '52px' }}
                      placeholder={isAr ? 'الاسم الكامل' : 'Full name'}
                    />
                  </Field>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Accordion 2: Academic Details */}
        <div className="frosted-panel rounded-2xl overflow-hidden border border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => toggleSection('academic')}
            className="w-full flex items-center justify-between px-5 py-4 bg-white/[0.015] hover:bg-white/[0.03] transition-colors text-right"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🎓</span>
              <div className="text-right">
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">{isAr ? 'البيانات الدراسية' : 'Academic Details'}</h3>
                <p className="text-[9px] text-[var(--text-secondary)] mt-0.5 font-bold">{isAr ? 'تحديد التخصص الدراسي، المستوى، والشعبة' : 'Set your major, academic level & class group'}</p>
              </div>
            </div>
            <span className="text-xs text-[var(--text-secondary)] font-bold">{activeSection === 'academic' ? '▲' : '▼'}</span>
          </button>

          <AnimatePresence initial={false}>
            {activeSection === 'academic' && (
              <motion.div
                key="academic-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="p-5 border-t border-[var(--border-color)] space-y-4 bg-[var(--bg-elevated)]/60">
                  {/* Major */}
                  <Field label={t('userSettings.majorLabel')}>
                    <select
                      value={profile.department}
                      onChange={e => setProfile(p => ({ ...p, department: e.target.value }))}
                      className="cmd-input w-full px-4 font-semibold cursor-pointer text-right"
                      style={{ height: '52px' }}
                    >
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d} className="bg-[var(--bg-card)] text-[var(--text-primary)]">{deptLabel(d)}</option>
                      ))}
                    </select>
                  </Field>

                  {/* Level + Group */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t('userSettings.levelLabel')}>
                      <select
                        value={profile.level}
                        onChange={e => setProfile(p => ({ ...p, level: e.target.value }))}
                        className="cmd-input w-full px-3 font-semibold cursor-pointer text-right"
                        style={{ height: '52px' }}
                      >
                        {(localStorage.getItem('selectedUniversitySlug') === 'health-institute'
                          ? LEVELS.filter(l => l === 'Level 1' || l === 'Level 2' || l === 'Level 3')
                          : LEVELS).map(l => (
                          <option key={l} value={l} className="bg-[var(--bg-card)] text-[var(--text-primary)]">
                            {l.replace('Level', isAr ? 'المستوى' : 'Level')}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label={t('userSettings.groupLabel')}>
                      <select
                        value={profile.groupId}
                        onChange={e => setProfile(p => ({ ...p, groupId: parseInt(e.target.value) }))}
                        className="cmd-input w-full px-3 font-bold cursor-pointer text-right"
                        style={{ height: '52px' }}
                      >
                        {groups.map(g => (
                          <option key={g.id} value={g.id} className="bg-[var(--bg-card)] text-[var(--text-primary)]">{g.name}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Accordion 3: Contact & Security */}
        <div className="frosted-panel rounded-2xl overflow-hidden border border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => toggleSection('security')}
            className="w-full flex items-center justify-between px-5 py-4 bg-white/[0.015] hover:bg-white/[0.03] transition-colors text-right"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🔐</span>
              <div className="text-right">
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">{isAr ? 'التواصل والأمان' : 'Contact & Security'}</h3>
                <p className="text-[9px] text-[var(--text-secondary)] mt-0.5 font-bold">{isAr ? 'إدارة البريد، الهاتف وكلمة المرور' : 'Manage email address, phone number & password'}</p>
              </div>
            </div>
            <span className="text-xs text-[var(--text-secondary)] font-bold">{activeSection === 'security' ? '▲' : '▼'}</span>
          </button>

          <AnimatePresence initial={false}>
            {activeSection === 'security' && (
              <motion.div
                key="security-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="p-5 border-t border-[var(--border-color)] space-y-4 bg-[var(--bg-elevated)]/60">
                  <Field label={t('userSettings.emailLabel')}>
                    <input
                      type="email"
                      required
                      value={profile.email}
                      onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                      className="cmd-input w-full px-4 font-semibold"
                      style={{ height: '52px' }}
                      dir="ltr"
                      placeholder="student@manar.edu"
                    />
                  </Field>

                  <Field label={t('userSettings.phoneLabel')}>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                      className="cmd-input w-full px-4 font-semibold"
                      style={{ height: '52px' }}
                      dir="ltr"
                      placeholder="+967 7XX XXX XXXX"
                    />
                  </Field>

                  <Field label={t('userSettings.passwordLabel')}>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="cmd-input w-full px-4 font-mono"
                      style={{ height: '52px' }}
                      dir="ltr"
                      placeholder={t('userSettings.passwordPlaceholder')}
                    />
                  </Field>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Accordion 4: Notification Settings */}
        <div className="frosted-panel rounded-2xl overflow-hidden border border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => toggleSection('notifications')}
            className="w-full flex items-center justify-between px-5 py-4 bg-white/[0.015] hover:bg-white/[0.03] transition-colors text-right"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🔔</span>
              <div className="text-right">
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">{isAr ? 'إعدادات التنبيهات' : 'Notification Settings'}</h3>
                <p className="text-[9px] text-[var(--text-secondary)] mt-0.5 font-bold">{isAr ? 'تخصيص قنوات التنبيه وتوقيت ما قبل المحاضرة' : 'Configure alert channels & pre-alert offsets'}</p>
              </div>
            </div>
            <span className="text-xs text-[var(--text-secondary)] font-bold">{activeSection === 'notifications' ? '▲' : '▼'}</span>
          </button>

          <AnimatePresence initial={false}>
            {activeSection === 'notifications' && (
              <motion.div
                key="notifications-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="p-5 border-t border-[var(--border-color)] space-y-4 bg-[var(--bg-elevated)]/60">
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] text-right">
                      {isAr ? 'قنوات التنبيهات المفعلة' : 'Active Alert Channels'}
                    </p>
                    <ToggleRow
                      label={t('settings.channelPush')}
                      desc={t('settings.channelPushDesc')}
                      checked={toggles.push}
                      onChange={v => setToggles(p => ({ ...p, push: v }))}
                    />
                    <ToggleRow
                      label={t('settings.channelSms')}
                      desc={t('settings.channelSmsDesc')}
                      checked={toggles.sms}
                      onChange={v => setToggles(p => ({ ...p, sms: v }))}
                    />
                    <ToggleRow
                      label={t('settings.channelEmail')}
                      desc={t('settings.channelEmailDesc')}
                      checked={toggles.email}
                      onChange={v => setToggles(p => ({ ...p, email: v }))}
                    />
                  </div>

                  <Field label={t('settings.warningOffset')}>
                    <select
                      value={toggles.preAlertTime}
                      onChange={e => setToggles(p => ({ ...p, preAlertTime: e.target.value }))}
                      className="cmd-input w-full px-4 font-bold cursor-pointer text-right"
                      style={{ height: '52px' }}
                    >
                      <option value="5" className="bg-[var(--bg-card)] text-[var(--text-primary)]">{t('settings.minutesBefore', { count: 5 })}</option>
                      <option value="15" className="bg-[var(--bg-card)] text-[var(--text-primary)]">{t('settings.minutesBefore', { count: 15 })}</option>
                      <option value="30" className="bg-[var(--bg-card)] text-[var(--text-primary)]">{t('settings.minutesBefore', { count: 30 })}</option>
                      <option value="60" className="bg-[var(--bg-card)] text-[var(--text-primary)]">{t('settings.hourBefore')}</option>
                    </select>
                  </Field>

                  {/* ── External Notifications (WhatsApp/Telegram) ── */}
                  <div className="space-y-3 pt-3 border-t border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] text-right">
                      {isAr ? 'التنبيهات الخارجية (واتساب / تليجرام)' : 'External Notifications (WhatsApp/Telegram)'}
                    </p>
                    
                    {/* WhatsApp Toggle */}
                    <ToggleRow
                      label={isAr ? 'تفعيل تنبيهات الواتساب' : 'Enable WhatsApp Alerts'}
                      desc={isAr ? 'تلقي إشعارات الحضور وتغيير الجداول عبر الواتساب' : 'Get attendance & rescheduling alerts via WhatsApp'}
                      checked={toggles.whatsappEnabled || false}
                      onChange={v => setToggles(p => ({ ...p, whatsappEnabled: v }))}
                    />
                    
                    {toggles.whatsappEnabled && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2 p-3 bg-slate-950/40 rounded-xl border border-[var(--border-color)]"
                      >
                        <Field label={isAr ? 'رقم الواتساب للتحقق' : 'WhatsApp Number for Verification'}>
                          <div className="flex gap-2">
                            <input
                              type="tel"
                              value={toggles.whatsappNumber || ''}
                              onChange={e => setToggles(p => ({ ...p, whatsappNumber: e.target.value }))}
                              className="cmd-input flex-1 px-3 text-xs font-semibold"
                              style={{ height: '42px' }}
                              dir="ltr"
                              placeholder="+967 7XX XXX XXX"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!toggles.whatsappNumber) {
                                  toast.error(isAr ? 'الرجاء إدخال رقم هاتف صالح' : 'Please enter a valid phone number');
                                  return;
                                }
                                toast.success(isAr ? 'تم إرسال رمز التحقق التجريبي!' : 'Mock verification code sent!');
                              }}
                              className="btn-ghost px-3 text-[10px] font-black shrink-0"
                              style={{ height: '42px' }}
                            >
                              {isAr ? 'تحقق' : 'Verify'}
                            </button>
                          </div>
                        </Field>
                      </motion.div>
                    )}

                    {/* Telegram Toggle */}
                    <ToggleRow
                      label={isAr ? 'تفعيل تنبيهات التليجرام' : 'Enable Telegram Alerts'}
                      desc={isAr ? 'تلقي التنبيهات عبر بوت التليجرام الخاص بالكلية' : 'Get alerts via college Telegram Bot'}
                      checked={toggles.telegramEnabled || false}
                      onChange={v => setToggles(p => ({ ...p, telegramEnabled: v }))}
                    />

                    {toggles.telegramEnabled && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2 p-3 bg-slate-950/40 rounded-xl border border-[var(--border-color)]"
                      >
                        <Field label={isAr ? 'اسم مستخدم التليجرام (بدون @)' : 'Telegram Username (without @)'}>
                          <input
                            type="text"
                            value={toggles.telegramUsername || ''}
                            onChange={e => setToggles(p => ({ ...p, telegramUsername: e.target.value }))}
                            className="cmd-input w-full px-3 text-xs font-semibold text-right"
                            style={{ height: '42px' }}
                            dir="ltr"
                            placeholder="username"
                          />
                        </Field>
                        <div className="text-[9px] text-slate-400 font-bold text-right leading-relaxed mt-1">
                          {isAr ? (
                            <span>لإكمال التفعيل، يرجى بدء المحادثة مع البوت: <a href="https://t.me/manar_schedule_bot" target="_blank" rel="noreferrer" className="text-emerald-400 underline">@manar_schedule_bot</a> وإرسال <code>/start</code></span>
                          ) : (
                            <span>To complete setup, start a chat with <a href="https://t.me/manar_schedule_bot" target="_blank" rel="noreferrer" className="text-emerald-400 underline">@manar_schedule_bot</a> and send <code>/start</code></span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Global Save Button */}
      <div className="w-full max-w-md pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full btn-neon font-black text-xs tracking-wider rounded-xl transition-all shadow-[0_4px_20px_var(--accent-glow)] active:scale-95 flex items-center justify-center"
          style={{ height: '56px' }}
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              {isAr ? 'جاري حفظ التغييرات...' : 'Saving changes...'}
            </span>
          ) : (
            `💾 ${isAr ? 'حفظ إعدادات الملف الشخصي' : 'Save Profile Changes'}`
          )}
        </button>
      </div>

      {/* PWA Updates & Android App at the bottom of settings file */}
      <div className="w-full max-w-md space-y-3 pt-4 border-t border-[var(--border-color)]">
        <a
          href="/Manar_Schedule.apk"
          download
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-[var(--accent-dim)] border border-[var(--accent-glow)] hover:bg-[var(--accent)] hover:text-black text-[var(--accent)] rounded-xl text-xs font-black transition-all duration-200 text-center"
          style={{ textDecoration: 'none' }}
        >
          <span>🤖</span>
          <span>{isAr ? 'تنزيل تطبيق الأندرويد (APK)' : 'Download Android App (APK)'}</span>
        </a>

        <button
          type="button"
          onClick={handleCheckUpdates}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-[var(--text-primary)] rounded-xl text-xs font-black transition-all duration-200"
        >
          <span>📥</span>
          <span>{isAr ? 'التحقق من التحديثات وتحديث البوابة' : 'Check for System Updates'}</span>
        </button>
      </div>

      {/* Developer signature link */}
      <div className="w-full max-w-md text-center pt-2">
        <DevSignature centered={true} />
      </div>

      {/* Bottom spacer for nav dock */}
      <div style={{ height: '32px' }} />
    </motion.div>
  );
}
