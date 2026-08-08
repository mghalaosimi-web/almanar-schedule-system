import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../config';
import Logo from '../Logo';
import ThemeSwitcher from '../ThemeSwitcher';
import PWAInstallModal from './PWAInstallModal';

// ─── Constants ────────────────────────────────────────────────────────────────
const SCHED_DAYS = ['SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
const DAYS_AR = {
  SUNDAY: 'الأحد', MONDAY: 'الاثنين', TUESDAY: 'الثلاثاء',
  WEDNESDAY: 'الأربعاء', THURSDAY: 'الخميس', FRIDAY: 'الجمعة', SATURDAY: 'السبت'
};
const DAYS_EN = {
  SUNDAY: 'Sunday', MONDAY: 'Monday', TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday'
};

// Assign color + icon per major name
const getMajorTheme = (name = '') => {
  const n = name;
  if (n.includes('صيدل') || n.toLowerCase().includes('pharma'))
    return { color: '#3b82f6', lightBg: '#eff6ff', darkBg: '#1e3a5f', icon: '💊', iconBg: '#3b82f620' };
  if (n.includes('تمريض') || n.toLowerCase().includes('nurs'))
    return { color: '#10b981', lightBg: '#ecfdf5', darkBg: '#064e3b', icon: '💉', iconBg: '#10b98120' };
  if (n.includes('عمليات') || n.includes('فني'))
    return { color: '#f59e0b', lightBg: '#fffbeb', darkBg: '#451a03', icon: '🔬', iconBg: '#f59e0b20' };
  if (n.includes('إدارة') || n.includes('صحي') || n.includes('admin'))
    return { color: '#8b5cf6', lightBg: '#f5f3ff', darkBg: '#2e1065', icon: '🏥', iconBg: '#8b5cf620' };
  if (n.includes('محاسب'))
    return { color: '#0ea5e9', lightBg: '#f0f9ff', darkBg: '#0c4a6e', icon: '📊', iconBg: '#0ea5e920' };
  if (n.includes('شريعة') || n.includes('قانون'))
    return { color: '#ef4444', lightBg: '#fef2f2', darkBg: '#450a0a', icon: '⚖️', iconBg: '#ef444420' };
  if (n.includes('هندس') || n.includes('تقني') || n.includes('معلوم'))
    return { color: '#14b8a6', lightBg: '#f0fdfa', darkBg: '#042f2e', icon: '💻', iconBg: '#14b8a620' };
  return { color: '#64748b', lightBg: '#f8fafc', darkBg: '#1e293b', icon: '📖', iconBg: '#64748b20' };
};

// Format time HH:MM
const fmt = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${h}:${m}`;
};

// ─── DevSplash ─────────────────────────────────────────────────────────────────
function DevSplash({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-primary)]"
      style={{ fontFamily: "'Urbanist', sans-serif" }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full blur-[120px] opacity-20 bg-cyan-500/30" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[150px] opacity-10 bg-purple-500/30" />
      </div>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.2 }}
        className="relative z-10 flex flex-col items-center gap-5"
      >
        <div className="relative">
          <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-cyan-500/30 to-purple-500/20 blur-xl animate-pulse" />
          <div className="relative w-24 h-24 rounded-[2rem] bg-gradient-to-br from-white/10 to-black/60 border border-white/20 shadow-2xl flex items-center justify-center">
            <span className="text-4xl font-black tracking-tighter select-none"
              style={{ background: 'linear-gradient(135deg, #22d3ee, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              M
            </span>
          </div>
        </div>
        <div className="text-center space-y-1">
          <a href="https://github.com/mghalaosimi-web" target="_blank" rel="noopener noreferrer">
            <h1 className="text-xl font-black tracking-widest text-white uppercase hover:text-cyan-400 transition-colors cursor-pointer">
              M.GH.AL
            </h1>
          </a>
          <p className="text-[11px] font-black tracking-[0.3em] uppercase text-cyan-400">Full-Stack Engineer</p>
        </div>
        <p className="text-[11px] text-white/50 font-bold text-center max-w-xs leading-relaxed px-4" dir="rtl">
          نظام جداول منار الذكي — برمجة وتطوير م. محمد غالب العصيمي
        </p>
        <div className="w-40 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
            initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2.5, ease: 'easeInOut' }} />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── InfoModal (About / Terms / Instructions) ──────────────────────────────────
function InfoModal({ type, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 w-full max-w-sm relative shadow-2xl"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-[var(--border-color)] hover:bg-white/20 flex items-center justify-center text-[var(--text-secondary)] hover:text-white transition-all text-sm font-bold">
          ✕
        </button>

        {type === 'about' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#3b82f620' }}>📱</div>
              <h3 className="text-base font-black text-[var(--text-primary)]">عن نظام جداول منار الذكي</h3>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              نظام منار هو منصة أكاديمية متكاملة تتيح للطلاب الاطلاع على جداول المحاضرات بشكل فوري ومحدّث لحظياً.
            </p>
            <div className="space-y-2">
              {[
                { icon: '📅', text: 'جداول دراسية محدّثة لحظياً' },
                { icon: '🔔', text: 'إشعارات عند تعديل أي محاضرة' },
                { icon: '📲', text: 'تسجيل الحضور عبر QR' },
                { icon: '🌐', text: 'يعمل بدون إنترنت (Offline Mode)' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-primary)' }}>
                  <span>{f.icon}</span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">{f.text}</span>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-[var(--border-color)] text-center">
              <p className="text-xs text-[var(--text-muted)]">برمجة وتطوير</p>
              <p className="text-sm font-black mt-1" style={{ color: 'var(--accent)' }}>م. محمد غالب العصيمي</p>
              <div className="flex justify-center gap-3 mt-2">
                <a href="https://wa.me/967776778675" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 text-xs font-bold">واتساب</a>
                <span className="text-[var(--text-muted)]">•</span>
                <a href="https://github.com/mghalaosimi-web" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 text-xs font-bold">GitHub</a>
              </div>
            </div>
          </div>
        )}

        {type === 'terms' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#f59e0b20' }}>📋</div>
              <h3 className="text-base font-black text-[var(--text-primary)]">الشروط والأحكام</h3>
            </div>
            <div className="space-y-2 text-sm text-[var(--text-secondary)] leading-relaxed max-h-64 overflow-y-auto">
              {[
                '١. استخدام النظام مخصص للطلاب والأكاديميين المسجلين رسمياً.',
                '٢. يلتزم المستخدم بسرية بيانات حسابه وعدم مشاركتها.',
                '٣. تسجيل الحضور إلكترونياً والطالب مسؤول عن صحة البيانات.',
                '٤. للإدارة الحق في تعليق أي حساب يخالف شروط الاستخدام.',
                '٥. لا يُسمح باستخدام حسابات الآخرين.',
                '٦. البيانات تُستخدم فقط لأغراض أكاديمية رسمية.',
                '٧. فقدان كلمة المرور يستوجب التواصل مع إدارة الكلية.',
                '٨. الجهة المطورة غير مسؤولة عن سوء الاستخدام.',
              ].map((t, i) => (
                <p key={i} className="py-2 border-b border-[var(--border-color)] last:border-0">{t}</p>
              ))}
            </div>
          </div>
        )}

        {type === 'instructions' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#8b5cf620' }}>📖</div>
              <h3 className="text-base font-black text-[var(--text-primary)]">تعليمات الاستخدام</h3>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {[
                { step: '١', icon: '📚', title: 'اختر تخصصك', desc: 'انقر على بطاقة تخصصك مباشرةً لعرض الجدول.' },
                { step: '٢', icon: '🔍', title: 'صفّح الجدول', desc: 'اختر المستوى والشعبة لعرض جدولك الدراسي.' },
                { step: '٣', icon: '🔐', title: 'سجّل دخولك', desc: 'انقر "تسجيل الدخول" للوصول لجميع ميزات النظام.' },
                { step: '٤', icon: '📲', title: 'ثبّت التطبيق', desc: 'استخدم زر "تحميل التطبيق" لتثبيته على هاتفك.' },
                { step: '٥', icon: '🌐', title: 'بدون إنترنت', desc: 'الجداول المحملة تظهر حتى بدون اتصال.' },
              ].map((s) => (
                <div key={s.step} className="flex gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-primary)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                    style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>{s.step}</div>
                  <div>
                    <p className="text-xs font-black text-[var(--text-primary)]">{s.icon} {s.title}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Schedule View ──────────────────────────────────────────────────────────────
function ScheduleView({ schedules, selectedMajor, isAr, loading, collegeId, onBack, onLogin, onSignup }) {
  const [filterLevel, setFilterLevel] = useState('');
  const [filterGroup, setFilterGroup] = useState('');

  // Extract unique levels and groups from schedule data
  const levels = useMemo(() => {
    const seen = new Set();
    return schedules
      .map((s) => s.group?.level)
      .filter((l) => l && !seen.has(l.id) && seen.add(l.id));
  }, [schedules]);

  const groups = useMemo(() => {
    const seen = new Set();
    return schedules
      .map((s) => s.group)
      .filter((g) => g && (!filterLevel || g.levelId === parseInt(filterLevel)) && !seen.has(g.id) && seen.add(g.id));
  }, [schedules, filterLevel]);

  // Filtered schedules
  const filtered = useMemo(() => {
    return schedules.filter((s) => {
      if (filterLevel && s.group?.levelId !== parseInt(filterLevel)) return false;
      if (filterGroup && s.groupId !== parseInt(filterGroup)) return false;
      return true;
    });
  }, [schedules, filterLevel, filterGroup]);

  // Group by day
  const byDay = useMemo(() => {
    const map = {};
    SCHED_DAYS.forEach((d) => { map[d] = []; });
    filtered.forEach((s) => {
      if (map[s.dayOfWeek] !== undefined) map[s.dayOfWeek].push(s);
    });
    Object.keys(map).forEach((d) => {
      map[d].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    });
    return map;
  }, [filtered]);

  const hasAnySchedule = filtered.length > 0;
  const theme = getMajorTheme(selectedMajor?.name || '');

  return (
    <div className="flex flex-col min-h-0 pb-28">
      {/* Major header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)]">
        <button onClick={onBack}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--border-color)] transition-colors"
          aria-label="back">
          <svg className="w-4 h-4 fill-[var(--text-secondary)]" viewBox="0 0 24 24">
            <path d={isAr ? 'M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z' : 'M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z'} />
          </svg>
        </button>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: theme.iconBg }}>
          {theme.icon}
        </div>
        <div>
          <p className="text-sm font-black text-[var(--text-primary)]">{selectedMajor?.name}</p>
          <p className="text-[11px] text-[var(--text-muted)]">{isAr ? 'الجدول الدراسي الأسبوعي' : 'Weekly Schedule'}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-4 py-3 flex gap-2 border-b border-[var(--border-color)]">
        <select
          value={filterLevel}
          onChange={(e) => { setFilterLevel(e.target.value); setFilterGroup(''); }}
          className="flex-1 text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 transition-all"
          style={{
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            focusRingColor: 'var(--accent)'
          }}
        >
          <option value="">{isAr ? '— المستوى الدراسي —' : '— Study Level —'}</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          disabled={!filterLevel && levels.length > 0}
          className="flex-1 text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 transition-all disabled:opacity-50"
          style={{
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
          }}
        >
          <option value="">{isAr ? '— الشعبة —' : '— Group —'}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Auth CTA strip */}
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-[var(--border-color)]"
        style={{ background: `${theme.color}08` }}>
        <span className="text-xs text-[var(--text-muted)] flex-1 font-bold">
          {isAr ? 'لعرض جدولك الشخصي وتتبع الحضور' : 'For personalized schedule & attendance'}
        </span>
        <button onClick={onLogin}
          className="text-xs font-black px-3 py-1.5 rounded-lg border transition-all"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-card)' }}>
          {isAr ? 'دخول' : 'Login'}
        </button>
        <button onClick={onSignup}
          className="text-xs font-black px-3 py-1.5 rounded-lg text-white transition-all"
          style={{ background: theme.color }}>
          {isAr ? 'تسجيل' : 'Sign Up'}
        </button>
      </div>

      {/* Schedule content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: theme.color, borderTopColor: 'transparent' }} />
          <p className="text-xs font-bold text-[var(--text-muted)]">{isAr ? 'جاري تحميل الجدول...' : 'Loading schedule...'}</p>
        </div>
      ) : !hasAnySchedule ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
          <div className="text-4xl">📭</div>
          <p className="text-sm font-black text-[var(--text-primary)]">
            {isAr ? 'لا يوجد جدول متاح حالياً' : 'No schedule available yet'}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {isAr ? 'جرّب تغيير المستوى أو الشعبة' : 'Try changing level or group filter'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-color)]">
          {SCHED_DAYS.map((day) => {
            const entries = byDay[day] || [];
            if (entries.length === 0) return null;
            return (
              <div key={day}>
                {/* Day header */}
                <div className="px-4 py-2 flex items-center gap-2" style={{ background: `${theme.color}08` }}>
                  <div className="w-1.5 h-4 rounded-full" style={{ background: theme.color }} />
                  <span className="text-xs font-black" style={{ color: theme.color }}>
                    {isAr ? DAYS_AR[day] : DAYS_EN[day]}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-bold ml-auto">
                    {entries.length} {isAr ? 'محاضرة' : 'lecture(s)'}
                  </span>
                </div>
                {/* Entries */}
                {entries.map((s, idx) => (
                  <div key={s.id || idx} className="px-4 py-3 flex items-center gap-3">
                    {/* Time column */}
                    <div className="w-14 shrink-0 text-center">
                      <p className="text-[11px] font-black" style={{ color: theme.color }}>{fmt(s.startTime)}</p>
                      <div className="w-px h-3 mx-auto my-0.5" style={{ background: `${theme.color}40` }} />
                      <p className="text-[11px] font-bold text-[var(--text-muted)]">{fmt(s.endTime)}</p>
                    </div>
                    {/* Divider dot */}
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: `${theme.color}40` }} />
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-[var(--text-primary)] truncate">
                        {s.subject?.name || (isAr ? 'مادة غير محددة' : 'Unknown Subject')}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {s.room?.name && (
                          <span className="text-[11px] text-[var(--text-muted)] font-bold flex items-center gap-1">
                            <span>🚪</span>{s.room.name}
                          </span>
                        )}
                        {s.group?.name && (
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: theme.iconBg, color: theme.color }}>
                            {s.group.name}
                          </span>
                        )}
                        {s.attendingGroups?.length > 1 && (
                          <span className="text-[10px] text-[var(--text-muted)] font-bold">
                            +{s.attendingGroups.length - 1} {isAr ? 'شعب' : 'groups'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Portal Component ──────────────────────────────────────────────────────
export default function PublicLandingWizard() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();

  // Splash
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem('splash_shown'));

  // Phase: 'loading' | 'majors' | 'schedule'
  const [phase, setPhase] = useState('loading');
  const [collegeId, setCollegeId] = useState(null);
  const [collegeName, setCollegeName] = useState('كلية المنار الأهلية');
  const [majors, setMajors] = useState([]);
  const [selectedMajor, setSelectedMajor] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [modalType, setModalType] = useState(null);

  // PWA
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPwaInstallModal, setShowPwaInstallModal] = useState(false);
  const [pwaModalInitialTab, setPwaModalInitialTab] = useState('pwa');

  // Dev tap (10 taps on logo → dev mode)
  const devTapCount = useRef(0);
  const devTapTimer = useRef(null);
  const handleLogoTap = () => {
    devTapCount.current += 1;
    if (devTapTimer.current) clearTimeout(devTapTimer.current);
    devTapTimer.current = setTimeout(() => { devTapCount.current = 0; }, 2000);
    if (devTapCount.current >= 10) {
      devTapCount.current = 0;
      navigate('/login?devModal=true');
    }
  };

  // Session check
  useEffect(() => {
    const token = localStorage.getItem('manar_token');
    const userJson = localStorage.getItem('manar_user');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        if (user.role === 'STUDENT') navigate('/student/home', { replace: true });
        else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') navigate('/admin/overview', { replace: true });
        else if (user.role === 'LECTURER') navigate('/lecturer/home', { replace: true });
      } catch (e) { /* ignored */ }
    }
  }, [navigate]);

  // PWA prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // ── Silent Bootstrap: fetch tenant + majors ──────────────────────────────────
  useEffect(() => {
    const bootstrap = async () => {
      // Serve from cache immediately for instant UX
      const cachedId = localStorage.getItem('almanar_college_id');
      const cachedMajors = localStorage.getItem('almanar_majors');
      const cachedName = localStorage.getItem('almanar_college_name');
      if (cachedId && cachedMajors) {
        setCollegeId(parseInt(cachedId));
        setMajors(JSON.parse(cachedMajors));
        if (cachedName) setCollegeName(cachedName);
        setPhase('majors');
      }

      // Then refresh from network
      try {
        const tenantRes = await axios.get(`${API_URL}/api/public/tenant/info?slug=almanar-college`);
        if (tenantRes.data?.success && tenantRes.data.data) {
          const config = tenantRes.data.data;
          const cId = config.college?.id ?? config.collegeId;
          const cName = config.college?.name || 'كلية المنار الأهلية';

          if (cId) {
            setCollegeId(cId);
            setCollegeName(cName);
            localStorage.setItem('almanar_college_id', cId);
            localStorage.setItem('almanar_college_name', cName);
            localStorage.setItem('selectedCollegeId', cId);
            localStorage.setItem('selectedCollegeName', cName);

            // Apply theme color if provided
            const themeColor = config.themeColor;
            if (themeColor) {
              document.documentElement.style.setProperty('--accent', themeColor);
              document.documentElement.style.setProperty('--accent-glow', `${themeColor}33`);
              document.documentElement.style.setProperty('--accent-dim', `${themeColor}1a`);
              localStorage.setItem('selectedUniversityThemeColor', themeColor);
            }

            // Fetch majors
            const majorsRes = await axios.get(`${API_URL}/api/public/majors?collegeId=${cId}`);
            if (majorsRes.data?.success && majorsRes.data.data?.length > 0) {
              const list = majorsRes.data.data;
              setMajors(list);
              localStorage.setItem('almanar_majors', JSON.stringify(list));
            }
            setPhase('majors');
          }
        }
      } catch (err) {
        console.warn('[AlManar Portal] Network error during bootstrap:', err.message);
        // Already served from cache above; if not cached use static fallback
        if (!cachedId) {
          setCollegeId(3);
          setMajors([
            { id: 1, name: 'صيدلة' },
            { id: 2, name: 'تمريض' },
            { id: 3, name: 'فني عمليات جراحية' },
            { id: 4, name: 'إدارة صحية' },
          ]);
          setPhase('majors');
        }
      }
    };
    bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch schedules when major is chosen ─────────────────────────────────────
  useEffect(() => {
    if (!selectedMajor || !collegeId) return;
    const fetch = async () => {
      setSchedulesLoading(true);
      try {
        const res = await axios.get(
          `${API_URL}/api/public/schedules?collegeId=${collegeId}&majorId=${selectedMajor.id}`
        );
        if (res.data?.success) {
          setSchedules(res.data.data);
          localStorage.setItem(`almanar_sched_${selectedMajor.id}`, JSON.stringify(res.data.data));
          localStorage.setItem('cached_student_ts', Date.now().toString());
          window.dispatchEvent(new CustomEvent('MANAR_DATA_SYNCED'));
        }
      } catch (err) {
        const cached = localStorage.getItem(`almanar_sched_${selectedMajor.id}`);
        if (cached) {
          setSchedules(JSON.parse(cached));
          toast(isAr ? '📡 جدول مخزن — قد لا يكون محدّثاً' : '📡 Cached schedule shown', { duration: 3000 });
        } else {
          toast.error(isAr ? 'فشل تحميل الجدول' : 'Failed to load schedule');
        }
      } finally {
        setSchedulesLoading(false);
      }
    };
    fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMajor?.id, collegeId]);

  const handleSelectMajor = (major) => {
    setSelectedMajor(major);
    setSchedules([]);
    setPhase('schedule');
    localStorage.setItem('preselectedMajorId', major.id);
    localStorage.setItem('preselectedMajorName', major.name);
  };

  const triggerApkDownload = (e, tab = 'apk') => {
    if (e?.preventDefault) e.preventDefault();
    try {
      const link = document.createElement('a');
      link.href = '/Manar_Schedule.apk';
      link.setAttribute('download', 'Manar_Schedule.apk');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (_) { /* silent */ }
    setPwaModalInitialTab(tab);
    setShowPwaInstallModal(true);
  };

  const handleLogin = () => navigate('/login');
  const handleSignup = () => navigate('/register', {
    state: { prefilledData: { collegeId, majorId: selectedMajor?.id } }
  });

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* DevSplash overlay */}
      <AnimatePresence>
        {showSplash && (
          <DevSplash onDone={() => {
            sessionStorage.setItem('splash_shown', '1');
            setShowSplash(false);
          }} />
        )}
      </AnimatePresence>

      {/* Main App */}
      <AnimatePresence>
        {!showSplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            dir={isAr ? 'rtl' : 'ltr'}
            className="min-h-screen flex flex-col items-center justify-start bg-[var(--bg-primary)]"
            style={{ fontFamily: 'var(--font-family, "Urbanist", "Cairo", sans-serif)' }}
          >
            {/* Centered container — max 480px (mobile-first) */}
            <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen relative">

              {/* ── Top Header Bar ─────────────────────────────────────────────── */}
              <header className="sticky top-0 z-40 bg-[var(--bg-card)] border-b border-[var(--border-color)]">
                {/* Row 1: Logo + Title + Actions */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Logo (tap 10× for dev) */}
                  <button onClick={handleLogoTap} className="shrink-0 focus:outline-none select-none" aria-label="logo">
                    <div className="w-9 h-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--border-color)] flex items-center justify-center overflow-hidden">
                      <img src="/almanar-logo.png" alt="المنار" className="w-full h-full object-contain"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  </button>

                  {/* College name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-[var(--text-primary)] truncate">{collegeName}</p>
                    <p className="text-[10px] text-[var(--text-muted)] font-bold truncate">
                      {isAr ? 'نظام الجداول الدراسية' : 'Academic Schedule System'}
                    </p>
                  </div>

                  {/* Utility buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* APK/PWA download */}
                    <button
                      onClick={(e) => triggerApkDownload(e, 'apk')}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all"
                      style={{
                        background: 'var(--accent-dim)',
                        color: 'var(--accent)',
                        border: '1px solid var(--accent-glow)'
                      }}
                      title={isAr ? 'تحميل التطبيق' : 'Download App'}
                    >
                      <span>📲</span>
                      <span className="hidden xs:inline">{isAr ? 'تطبيق' : 'App'}</span>
                    </button>

                    {/* Theme Switcher */}
                    <ThemeSwitcher />

                    {/* Language toggle */}
                    <button
                      onClick={() => i18n.changeLanguage(isAr ? 'en' : 'ar')}
                      className="px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all"
                      style={{
                        background: 'var(--bg-primary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      {isAr ? 'EN' : 'عربي'}
                    </button>
                  </div>
                </div>
              </header>

              {/* ── Main Content ──────────────────────────────────────────────── */}
              <main className="flex-1 overflow-auto">
                <AnimatePresence mode="wait">

                  {/* Loading phase */}
                  {phase === 'loading' && (
                    <motion.div key="loading"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-32 gap-4"
                    >
                      <div className="w-8 h-8 rounded-full border-2 animate-spin"
                        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                      <p className="text-xs font-bold text-[var(--text-muted)]">
                        {isAr ? 'جاري تحميل التخصصات...' : 'Loading majors...'}
                      </p>
                    </motion.div>
                  )}

                  {/* Majors selection phase */}
                  {phase === 'majors' && (
                    <motion.div key="majors"
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}
                    >
                      {/* Admin/Faculty entry strip */}
                      <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
                        <p className="text-xs font-bold text-[var(--text-muted)]">
                          {isAr ? 'من أعضاء الهيئة التدريسية أو الإدارة؟' : 'Faculty or Admin member?'}
                        </p>
                        <button
                          onClick={() => navigate('/login?tab=FACULTY')}
                          className="text-xs font-black px-3 py-1.5 rounded-xl transition-all"
                          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                        >
                          {isAr ? 'بوابة الكادر ←' : 'Faculty Portal →'}
                        </button>
                      </div>

                      {/* Section title */}
                      <div className="px-4 pt-4 pb-2">
                        <h1 className="text-base font-black text-[var(--text-primary)]">
                          {isAr ? 'التخصصات الدراسية' : 'Academic Majors'}
                        </h1>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {isAr ? 'اختر تخصصك لعرض الجدول الدراسي الكامل' : 'Select your major to view the full schedule'}
                        </p>
                      </div>

                      {/* Major cards list */}
                      {majors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
                          <div className="text-4xl">🏛️</div>
                          <p className="text-sm font-black text-[var(--text-primary)]">
                            {isAr ? 'لا توجد تخصصات مسجلة حالياً' : 'No majors registered yet'}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {isAr ? 'سيتم إضافتها قريباً من الإدارة' : 'Admin will add them soon'}
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-[var(--border-color)]">
                          {majors.map((major, i) => {
                            const th = getMajorTheme(major.name);
                            return (
                              <motion.button
                                key={major.id}
                                initial={{ opacity: 0, x: isAr ? 20 : -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04, duration: 0.2 }}
                                onClick={() => handleSelectMajor(major)}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-right hover:bg-[var(--accent-dim)] active:scale-[0.99] transition-all"
                                aria-label={major.name}
                              >
                                {/* Colored icon square */}
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                                  style={{ background: th.iconBg }}>
                                  {th.icon}
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0 text-right">
                                  <p className="text-sm font-black text-[var(--text-primary)] truncate">{major.name}</p>
                                  <p className="text-[11px] text-[var(--text-muted)] font-bold mt-0.5">{collegeName}</p>
                                </div>

                                {/* Arrow */}
                                <svg className="w-4 h-4 shrink-0"
                                  style={{ fill: th.color }}
                                  viewBox="0 0 24 24">
                                  <path d={isAr ? 'M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z' : 'M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z'} />
                                </svg>
                              </motion.button>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Schedule view phase */}
                  {phase === 'schedule' && selectedMajor && (
                    <motion.div key="schedule"
                      initial={{ opacity: 0, x: isAr ? -30 : 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: isAr ? 30 : -30 }}
                      transition={{ duration: 0.25 }}
                    >
                      <ScheduleView
                        schedules={schedules}
                        selectedMajor={selectedMajor}
                        isAr={isAr}
                        loading={schedulesLoading}
                        collegeId={collegeId}
                        onBack={() => { setPhase('majors'); setSelectedMajor(null); setSchedules([]); }}
                        onLogin={handleLogin}
                        onSignup={handleSignup}
                      />
                    </motion.div>
                  )}

                </AnimatePresence>
              </main>

              {/* ── Footer ───────────────────────────────────────────────────── */}
              {phase !== 'schedule' && (
                <footer className="border-t border-[var(--border-color)] px-4 py-4 bg-[var(--bg-card)]">
                  {/* Info links */}
                  <div className="flex items-center justify-center gap-4 mb-3">
                    <button onClick={() => setModalType('about')}
                      className="text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1">
                      📱 {isAr ? 'عن النظام' : 'About'}
                    </button>
                    <span className="text-[var(--border-color)]">•</span>
                    <button onClick={() => setModalType('terms')}
                      className="text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1">
                      📋 {isAr ? 'الشروط' : 'Terms'}
                    </button>
                    <span className="text-[var(--border-color)]">•</span>
                    <button onClick={() => setModalType('instructions')}
                      className="text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1">
                      📖 {isAr ? 'تعليمات' : 'Guide'}
                    </button>
                  </div>

                  {/* Developer signature */}
                  <div className="text-center">
                    <p className="text-[10px] text-[var(--text-muted)] font-bold">
                      {isAr ? 'برمجة وتطوير' : 'Developed by'}{' '}
                      <a href="https://github.com/mghalaosimi-web" target="_blank" rel="noopener noreferrer"
                        className="font-black hover:text-[var(--accent)] transition-colors"
                        style={{ color: 'var(--text-secondary)' }}>
                        M.GH.AL
                      </a>
                    </p>
                    {/* Social mini icons */}
                    <div className="flex justify-center gap-2 mt-2">
                      {[
                        { href: 'https://wa.me/967776778675', title: 'WhatsApp', color: '#25d366', path: 'M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.449 5.4 0 9.793-4.393 9.797-9.799.002-2.618-1.01-5.08-2.858-6.932C16.36 2.022 13.9 1.01 11.3 1.01 5.9 1.01 1.5 5.4 1.5 10.8c0 1.5.4 3 1.2 4.4l-.9 3.4 3.4-.9v.054z' },
                        { href: 'https://github.com/mghalaosimi-web', title: 'GitHub', color: '#a855f7', path: 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' },
                        { href: 'https://t.me/mghalaosimi', title: 'Telegram', color: '#0ea5e9', path: 'M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.562 8.161c-.18.717-.962 4.084-1.362 5.477-.168.587-.367.876-.566.906-.438.066-.772-.259-1.196-.537-.665-.436-1.041-.707-1.687-1.132-.747-.492-.263-.762.163-1.204.111-.116 2.049-1.879 2.087-2.041.005-.02.01-.097-.036-.136-.046-.04-.112-.027-.161-.016-.07.016-1.187.755-3.342 2.21-.316.217-.602.324-.858.318-.282-.006-.826-.16-1.229-.291-.496-.162-.889-.249-.855-.527.017-.145.218-.294.602-.446 2.366-.99 3.942-1.644 4.729-1.963 2.249-.913 2.716-1.071 3.021-1.076.067-.001.218.016.315.096.082.067.105.158.114.223.009.066.012.203.003.312z' },
                      ].map(({ href, title, color, path }) => (
                        <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                          className="w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
                          style={{ background: `${color}15`, border: `1px solid ${color}30` }}
                          title={title} aria-label={title}>
                          <svg className="w-3 h-3" style={{ fill: color }} viewBox="0 0 24 24">
                            <path d={path} />
                          </svg>
                        </a>
                      ))}
                    </div>
                  </div>
                </footer>
              )}

            </div>{/* End centered container */}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Info Modals ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalType && <InfoModal type={modalType} onClose={() => setModalType(null)} />}
      </AnimatePresence>

      {/* ── PWA / APK Install Modal ──────────────────────────────────────────── */}
      <PWAInstallModal
        isOpen={showPwaInstallModal}
        onClose={() => setShowPwaInstallModal(false)}
        deferredPrompt={deferredPrompt}
        initialTab={pwaModalInitialTab || 'pwa'}
      />
    </>
  );
}
