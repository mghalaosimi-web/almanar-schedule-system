import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { API_URL, GOOGLE_CLIENT_ID } from '../config';
import Logo from '../Logo';
import ThemeSwitcher from '../ThemeSwitcher';
import PWAInstallModal from './PWAInstallModal';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

class SafeGoogleLogin extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.warn("Caught Google Login unmount error safely:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ─── DevSplash ─────────────────────────────────────────────────────────────────
function DevSplash({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)]"
      style={{ fontFamily: 'var(--font-family, "Urbanist", "Cairo", sans-serif)' }}
    >
      {/* Background Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-[140px] opacity-25 bg-[var(--accent)]" />
      </div>

      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 130, damping: 15, delay: 0.1 }}
        className="relative z-10 flex flex-col items-center gap-4 text-center px-6"
      >
        {/* Al-Manar Emblem Shield */}
        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-[var(--accent-dim)] blur-xl animate-pulse" />
          <div className="relative w-24 h-24 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl p-3 flex items-center justify-center">
            <img src="/almanar-logo.png" alt="كلية المنار الجامعية" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Welcome Headline */}
        <div className="space-y-1 mt-2">
          <h2 className="text-sm font-black tracking-widest text-[var(--accent)] uppercase">
            كلية المنار الجامعية ترحب بكم
          </h2>
          <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
            بوابة الطالب الأكاديمية
          </h1>
        </div>

        {/* Developer Badge Signature */}
        <div className="pt-2 border-t border-[var(--border-color)] w-full max-w-xs space-y-1">
          <p className="text-xs font-black tracking-wider uppercase text-[var(--text-secondary)]">
            برمجة وتطوير M.GH.AL
          </p>
          <p className="text-[11px] text-[var(--text-muted)] font-bold">
            Full-Stack Engineer — م. محمد غالب العصيمي
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-44 h-1 bg-[var(--border-color)] rounded-full overflow-hidden mt-2">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--accent)' }}
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.0, ease: 'easeInOut' }}
          />
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
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4"
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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'var(--accent-dim)' }}>📱</div>
              <h3 className="text-base font-black text-[var(--text-primary)]">عن كلية المنار الجامعية</h3>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              البوابة الرقمية الموحدة لكمال وتتبع المحاضرات، الجداول الأكاديمية، وتسجيل الحضور الذكي بكلية المنار الجامعية.
            </p>
            <div className="space-y-2">
              {[
                { icon: '⚡', text: 'تسجيل دخول موحد وسريع للطلاب والكادر' },
                { icon: '📅', text: 'جداول دراسية وحضور لحظي' },
                { icon: '🔔', text: 'تنبيهات فورية عند تعديل أي قاعة' },
                { icon: '📲', text: 'تسجيل الحضور التلقائي عبر الـ QR' },
                { icon: '🌐', text: 'تطبيق ويب أوفلاين بدون انقطاع' },
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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'var(--accent-dim)' }}>📋</div>
              <h3 className="text-base font-black text-[var(--text-primary)]">الشروط والأحكام</h3>
            </div>
            <div className="space-y-2 text-sm text-[var(--text-secondary)] leading-relaxed max-h-64 overflow-y-auto">
              {[
                '١. استخدام البوابة مخصص للطلاب وأكاديميي كلية المنار الجامعية.',
                '٢. يلتزم المستخدم بسرية بيانات حسابه وعدم مشاركتها.',
                '٣. تسجيل الحضور يتم إلكترونياً وبأمان عبر الجلسة.',
                '٤. للإدارة الحق في تعليق الحسابات المخالفة للضوابط.',
                '٥. البيانات المدخلة تُستخدم فقط لأغراض أكاديمية رسمية.',
                '٦. عند حدوث أي مشكلة في الحساب، يرجى التواصل مع الدعم الأكاديمي.',
              ].map((t, i) => (
                <p key={i} className="py-2 border-b border-[var(--border-color)] last:border-0">{t}</p>
              ))}
            </div>
          </div>
        )}

        {type === 'instructions' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'var(--accent-dim)' }}>📖</div>
              <h3 className="text-base font-black text-[var(--text-primary)]">تعليمات الاستخدام</h3>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {[
                { step: '١', icon: '🔑', title: 'تسجيل الدخول', desc: 'أدخل بريدك الجامعي/الرقم الجامعي وكلمة المرور للدخول المباشر للنظام.' },
                { step: '٢', icon: '🌐', title: 'دخول Google', desc: 'يمكن للطلاب تسجيل الدخول مباشرة بحساب Google الموثق بنقرة واحدة.' },
                { step: '٣', icon: '👨‍🏫', title: 'دخول الكادر', desc: 'أعضاء هيئة التدريس يمكنهم التبديل لتبويب الكادر لتسجيل الدخول.' },
                { step: '٤', icon: '📲', title: 'تثبيت التطبيق', desc: 'استخدم زر "تحميل التطبيق" لتثبيته كـ PWA أو APK.' },
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

// ─── Main Al-Manar University College Dedicated Portal ─────────────────────────
export default function PublicLandingWizard() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();

  // Splash
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem('splash_shown'));

  // College details
  const collegeName = 'كلية المنار الجامعية';

  // Login role tab: 'STUDENT' | 'FACULTY'
  const [activeRoleTab, setActiveRoleTab] = useState('STUDENT');

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // System Modals
  const [modalType, setModalType] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPwaInstallModal, setShowPwaInstallModal] = useState(false);
  const [pwaModalInitialTab, setPwaModalInitialTab] = useState('pwa');

  // Dev passcode trigger (10 taps on logo)
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

  // Session Restoration
  useEffect(() => {
    const token = localStorage.getItem('manar_token');
    const userJson = localStorage.getItem('manar_user');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        if (user.role === 'STUDENT') navigate('/student/home', { replace: true });
        else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'COLLEGE_ADMIN' || user.role === 'UNI_ADMIN') navigate('/admin/overview', { replace: true });
        else if (user.role === 'LECTURER') navigate('/lecturer/home', { replace: true });
      } catch (e) { /* ignored */ }
    }
  }, [navigate]);

  // Listen for PWA prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Login handler
  const handleDirectLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const collegeId = localStorage.getItem('almanar_college_id') || '3';
      const res = await axios.post(`${API_URL}/api/auth/login`, {
        identifier,
        password,
        collegeId: parseInt(collegeId)
      });
      if (res.data?.success) {
        const { token, user } = res.data;
        localStorage.setItem('manar_token', token);
        localStorage.setItem('manar_user', JSON.stringify(user));
        toast.success(isAr ? `مرحباً بك، ${user.name}` : `Welcome back, ${user.name}`);
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'COLLEGE_ADMIN' || user.role === 'UNI_ADMIN') {
          navigate('/admin/overview');
        } else if (user.role === 'LECTURER') {
          navigate('/lecturer/home');
        } else {
          localStorage.setItem('student_profile', JSON.stringify({
            name: user.name,
            email: user.email,
            department: '',
            level: '',
            groupId: user.groupId || 1,
          }));
          navigate('/student/home');
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || (isAr ? 'بيانات الدخول غير صحيحة، يرجى المحاولة مجدداً' : 'Invalid credentials');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth Success Handler
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError(null);
    try {
      const collegeId = localStorage.getItem('almanar_college_id') || '3';
      const res = await axios.post(`${API_URL}/api/auth/google`, {
        credential: credentialResponse.credential,
        collegeId: parseInt(collegeId)
      });
      if (res.data?.success) {
        const { token, user } = res.data;
        localStorage.setItem('manar_token', token);
        localStorage.setItem('manar_user', JSON.stringify(user));
        toast.success(isAr ? `أهلاً بك، ${user.name}` : `Welcome, ${user.name}`);
        localStorage.setItem('student_profile', JSON.stringify({
          name: user.name,
          email: user.email,
          department: '',
          level: '',
          groupId: user.groupId || 1,
        }));
        navigate('/student/home');
      }
    } catch (err) {
      const msg = err.response?.data?.error || (isAr ? 'فشل تسجيل الدخول بواسطة Google' : 'Google login failed');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
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
            className="min-h-screen flex flex-col items-center justify-start bg-[var(--bg-primary)] text-[var(--text-primary)]"
            style={{ fontFamily: 'var(--font-family, "Urbanist", "Cairo", sans-serif)' }}
          >
            {/* Centered Mobile-First Gateway Container (max 460px) */}
            <div className="w-full max-w-[460px] mx-auto flex flex-col min-h-screen relative shadow-2xl border-x border-[var(--border-color)]">

              {/* ── Integrated Header Bar ─────────────────────────────────────────────── */}
              <header className="sticky top-0 z-40 bg-[var(--bg-card)] border-b border-[var(--border-color)] backdrop-blur-md">
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Logo (10x tap dev trigger) */}
                  <button onClick={handleLogoTap} className="shrink-0 focus:outline-none select-none" aria-label="logo">
                    <div className="w-9 h-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--border-color)] flex items-center justify-center overflow-hidden">
                      <img src="/almanar-logo.png" alt="المنار" className="w-full h-full object-contain"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  </button>

                  {/* College Title */}
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-black text-[var(--text-primary)] truncate">{collegeName}</p>
                    <p className="text-[10px] text-[var(--text-muted)] font-bold truncate">
                      {isAr ? 'البوابة الأكاديمية الذكية' : 'Smart Academic Gateway'}
                    </p>
                  </div>

                  {/* Utilities */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* App download */}
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

              {/* ── Main Dedicated Login Gateway ───────────────────────────────── */}
              <main className="flex-1 flex flex-col justify-center px-4 py-6">
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-2xl relative overflow-hidden"
                >
                  {/* Top glowing accent bar */}
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[var(--accent)] via-cyan-500 to-[var(--accent-dim)]" />

                  {/* Institution Shield / Brand Header */}
                  <div className="flex flex-col items-center text-center mb-4 pt-2">
                    <div onClick={handleLogoTap} className="w-16 h-16 rounded-2xl bg-[var(--accent-dim)] border border-[var(--accent-glow)] p-2 flex items-center justify-center mb-3 shadow-lg cursor-pointer">
                      <Logo size="md" customLogoUrl="/almanar-logo.png" />
                    </div>
                    <h1 className="text-lg font-black text-[var(--text-primary)]">
                      {collegeName}
                    </h1>
                    <p className="text-xs text-[var(--text-muted)] font-bold mt-0.5">
                      {isAr ? 'تسجيل الدخول المباشر إلى النظام' : 'Direct System Access Portal'}
                    </p>
                  </div>

                  {/* 📲 Direct Mobile App Download Banner */}
                  <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-cyan-500/15 to-blue-500/15 border border-emerald-500/30 text-right">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📲</span>
                        <div>
                          <p className="text-xs font-black text-white">تطبيق جداول المنار للأندرويد</p>
                          <p className="text-[10px] text-emerald-400 font-bold">الإصدار الرسمى v2.0.0 (53.8 MB)</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                        APK مباشر
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <a
                        href="/Manar_Schedule.apk"
                        download="Manar_Schedule.apk"
                        className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 no-underline text-center cursor-pointer"
                      >
                        <span>📥</span>
                        <span>تحميل وتثبيت التطبيق الآن (APK)</span>
                      </a>
                      <button
                        type="button"
                        onClick={(e) => triggerApkDownload(e, 'apk')}
                        className="py-2.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs transition-all cursor-pointer"
                        title="خيارات إضافية"
                      >
                        <span>⚙️ خيارات</span>
                      </button>
                    </div>
                    <p className="text-[9.5px] text-white/60 font-bold text-center mt-2 leading-relaxed">
                      💡 في حال ظهور تنبيه حماية من أندرويد عند الفتح: اختر <span className="text-emerald-400 font-black">"التثبيت على أي حال" (Install Anyway)</span>.
                    </p>
                  </div>

                  {/* Role Selector Tabs (Student vs Faculty) */}
                  <div className="flex p-1 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] mb-5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => { setActiveRoleTab('STUDENT'); setError(null); }}
                      className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                        activeRoleTab === 'STUDENT'
                          ? 'shadow-md font-black'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                      style={activeRoleTab === 'STUDENT' ? { background: 'var(--accent)', color: '#000' } : {}}
                    >
                      <span>🎓</span>
                      <span>{isAr ? 'بوابة الطالب' : 'Student Portal'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setActiveRoleTab('FACULTY'); setError(null); }}
                      className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                        activeRoleTab === 'FACULTY'
                          ? 'shadow-md font-black'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                      style={activeRoleTab === 'FACULTY' ? { background: 'var(--accent)', color: '#000' } : {}}
                    >
                      <span>👨‍🏫</span>
                      <span>{isAr ? 'الهيئة التدريسية والإدارة' : 'Faculty & Admin'}</span>
                    </button>
                  </div>

                  {/* Error Alert Box */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 overflow-hidden"
                      >
                        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold space-y-2">
                          <div className="flex items-center gap-2">
                            <span>⚠️</span>
                            <span>{error}</span>
                          </div>
                          {error.includes('غير مربوط') && (
                            <button
                              type="button"
                              onClick={() => navigate('/register')}
                              className="w-full py-2 px-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-white text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>🚀</span>
                              <span>{isAr ? 'اضغط هنا لإنشاء حساب طالب جديد وتوثيقه' : 'Click here to register & link account'}</span>
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Direct Login Form */}
                  <form onSubmit={handleDirectLogin} className="space-y-4">
                    {/* Identifier */}
                    <div className="space-y-1 text-right">
                      <label className="text-[11px] font-black uppercase text-[var(--text-secondary)] block">
                        {activeRoleTab === 'STUDENT'
                          ? (isAr ? 'البريد الجامعي / الرقم الجامعي' : 'University Email / Student ID')
                          : (isAr ? 'اسم المستخدم / البريد الإلكتروني' : 'Username / Faculty Email')}
                      </label>
                      <input
                        type="text"
                        required
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={
                          activeRoleTab === 'STUDENT'
                            ? (isAr ? 'مثال: 20241001 أو student@almanar.edu.ye' : 'e.g. 20241001 or student@almanar.edu.ye')
                            : (isAr ? 'أدخل اسم المستخدم أو البريد' : 'Enter username or email')
                        }
                        className="w-full text-xs font-bold rounded-xl px-4 py-3 transition-all focus:outline-none focus:ring-1"
                        style={{
                          background: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                        }}
                      />
                    </div>

                    {/* Password */}
                    <div className="space-y-1 text-right">
                      <label className="text-[11px] font-black uppercase text-[var(--text-secondary)] block">
                        {isAr ? 'كلمة المرور' : 'Password'}
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full text-xs font-bold rounded-xl pr-4 pl-10 py-3 transition-all focus:outline-none focus:ring-1"
                          style={{
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          {showPassword ? '👁️' : '🔒'}
                        </button>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 rounded-xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                      style={{
                        background: 'var(--accent)',
                        color: '#000',
                        boxShadow: '0 4px 20px var(--accent-glow)'
                      }}
                    >
                      {loading ? (
                        <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                      ) : (
                        <>
                          <span>🚀</span>
                          <span>{isAr ? 'تسجيل الدخول إلى النظام' : 'Sign In To System'}</span>
                        </>
                      )}
                    </button>
                  </form>

                  {/* Google 1-Click Login for Students */}
                  {activeRoleTab === 'STUDENT' && (
                    <div className="mt-5 pt-4 border-t border-[var(--border-color)] space-y-3">
                      <p className="text-[10px] text-center font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {isAr ? 'أو الدخول بنقرة واحدة لطلاب كلية المنار' : 'Or 1-Click Google Sign-In'}
                      </p>
                      <div className="w-full flex justify-center google-login-container" dir="ltr">
                        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                          <SafeGoogleLogin>
                            <GoogleLogin
                              onSuccess={handleGoogleSuccess}
                              onError={() => {
                                toast.error(isAr ? 'فشل الاتصال بخدمة Google' : 'Google connection failed');
                              }}
                              theme="filled_black"
                              size="large"
                              shape="rectangular"
                              width="340"
                            />
                          </SafeGoogleLogin>
                        </GoogleOAuthProvider>
                      </div>
                    </div>
                  )}

                  {/* Register New Account Link */}
                  <div className="mt-5 pt-4 border-t border-[var(--border-color)] text-center">
                    <p className="text-xs text-[var(--text-muted)] font-bold">
                      {isAr ? 'طالب جديد في كلية المنار؟ ' : "New Student at Al-Manar? "}
                      <button
                        type="button"
                        onClick={() => navigate('/register')}
                        className="font-black underline transition-colors cursor-pointer"
                        style={{ color: 'var(--accent)' }}
                      >
                        {isAr ? 'أنشئ حسابك الآن' : 'Create an Account'}
                      </button>
                    </p>
                  </div>
                </motion.div>
              </main>

              {/* ── Footer ───────────────────────────────────────────────────── */}
              <footer className="border-t border-[var(--border-color)] px-4 py-4 bg-[var(--bg-card)] mt-auto">
                {/* Info links */}
                <div className="flex items-center justify-center gap-4 mb-3">
                  <button onClick={() => setModalType('about')}
                    className="text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer">
                    📱 {isAr ? 'عن الكلية' : 'About'}
                  </button>
                  <span className="text-[var(--border-color)]">•</span>
                  <button onClick={() => setModalType('terms')}
                    className="text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer">
                    📋 {isAr ? 'الشروط' : 'Terms'}
                  </button>
                  <span className="text-[var(--border-color)]">•</span>
                  <button onClick={() => setModalType('instructions')}
                    className="text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer">
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
                      M.GH.AL — م. محمد غالب العصيمي
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

            </div>
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
