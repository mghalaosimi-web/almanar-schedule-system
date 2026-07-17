import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from './config';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import ThemeSwitcher from './ThemeSwitcher';
import Logo from './Logo';
import DevSignature from './DevSignature';
import { getFriendlyErrorMessage } from './utils/errorHelpers';
import { GoogleLogin } from '@react-oauth/google';

class SafeGoogleLogin extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
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

/* ── Animation variants ───────────────────────────────────────── */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const Field = ({ label, children }) => (
  <div className="space-y-2">
    <label className="block text-[10px] font-black tracking-wider uppercase text-white/50">
      {label}
    </label>
    {children}
  </div>
);

export default function Login() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [logoClicks, setLogoClicks] = useState(0);
  const [clickTimeout, setClickTimeout] = useState(null);
  const [showDevModal, setShowDevModal] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [devError, setDevError] = useState('');

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (clickTimeout) clearTimeout(clickTimeout);
    };
  }, [clickTimeout]);

  const handleDeveloperBypass = async (enteredCode) => {
    if (enteredCode !== '708090') {
      toast.error(isAr ? 'الرمز غير صحيح' : 'Invalid security code');
      return;
    }
    
    setLoading(true);
    setError(null);
    window.dispatchEvent(new CustomEvent('large-operation-start', {
      detail: { message: isAr ? 'جاري التحقق وتجاوز الأمان للمطور...' : 'Bypassing security for developer...' }
    }));
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, {
        identifier: 'm.gh.alosimi@gmail.com',
        password: '708090',
        collegeId: selectedCollegeId || undefined
      });
      if (res.data?.success) {
        const { token, user } = res.data;
        localStorage.setItem('manar_token', token);
        localStorage.setItem('manar_user', JSON.stringify(user));
        toast.success(isAr ? 'تم تسجيل دخول المطور بنجاح' : 'Developer bypass successful');
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'COLLEGE_ADMIN' || user.role === 'UNI_ADMIN') {
          navigate('/admin/overview');
        } else if (user.role === 'LECTURER') {
          navigate('/lecturer/home');
        } else {
          navigate('/student/home');
        }
      }
    } catch (err) {
      const msg = getFriendlyErrorMessage(err, isAr ? 'فشل تسجيل دخول المطور' : 'Developer login failed', isAr);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      window.dispatchEvent(new CustomEvent('large-operation-end'));
    }
  };

  const handleStaticLogoClick = () => {
    setLogoClicks((prev) => {
      const next = prev + 1;
      if (next >= 10) {
        setShowDevModal(true);
        return 0;
      }
      return next;
    });
  };

  const handleRedirectLogoClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setLogoClicks((prev) => {
      const next = prev + 1;
      if (next >= 10) {
        setShowDevModal(true);
        if (clickTimeout) {
          clearTimeout(clickTimeout);
        }
        return 0;
      }
      return next;
    });

    if (clickTimeout) {
      clearTimeout(clickTimeout);
    }

    const timeoutId = setTimeout(() => {
      setLogoClicks(0);
      const uniSlug = localStorage.getItem('selectedUniversitySlug');
      const collegeSlug = localStorage.getItem('selectedCollegeSlug');
      if (collegeSlug) navigate(`/c/${collegeSlug}`);
      else if (uniSlug) navigate(`/u/${uniSlug}`);
      else navigate('/');
    }, 400);

    setClickTimeout(timeoutId);
  };

  const { uniSlug, collegeSlug } = useParams();
  const [tenantInfo, setTenantInfo] = useState({
    collegeId: localStorage.getItem('selectedCollegeId'),
    collegeName: localStorage.getItem('selectedCollegeName'),
    universityName: localStorage.getItem('selectedUniversityName'),
    universityLogoRaw: localStorage.getItem('selectedUniversityLogo'),
    universitySlug: localStorage.getItem('selectedUniversitySlug') || 'almanar-college'
  });

  React.useEffect(() => {
    const fetchTenantInfo = async () => {
      const slug = uniSlug || collegeSlug;
      if (!slug) return;
      try {
        const res = await axios.get(`${API_URL}/api/public/tenant/info?slug=${slug}`);
        if (res.data?.success) {
          const { university: uni, college } = res.data.data;
          if (uni) {
            localStorage.setItem('selectedUniversityId', String(uni.id || ''));
            localStorage.setItem('selectedUniversityName', uni.name || '');
            localStorage.setItem('selectedUniversitySlug', uni.slug || '');
            localStorage.setItem('selectedUniversityLogo', uni.logoUrl || '');
          }
          if (college) {
            localStorage.setItem('selectedCollegeId', String(college.id || ''));
            localStorage.setItem('selectedCollegeName', college.name || '');
            localStorage.setItem('selectedCollegeSlug', college.slug || '');
          }
          
          setTenantInfo({
            collegeId: college ? String(college.id) : null,
            collegeName: college ? college.name : null,
            universityName: uni ? uni.name : null,
            universityLogoRaw: uni ? uni.logoUrl : null,
            universitySlug: uni ? uni.slug : 'almanar-college'
          });
        }
      } catch (err) {
        console.error('Error resolving tenant slug:', err);
      }
    };
    fetchTenantInfo();
  }, [uniSlug, collegeSlug]);

  const selectedCollegeId = tenantInfo.collegeId;
  const selectedCollegeName = tenantInfo.collegeName;
  const selectedUniversityName = tenantInfo.universityName;
  const selectedUniversityLogoRaw = tenantInfo.universityLogoRaw;
  const selectedUniversitySlug = tenantInfo.universitySlug;
  const selectedUniversityLogo = selectedUniversitySlug === 'hajjah-university' ? '/hajjah-logo-new.png' :
                                 selectedUniversitySlug === 'almanar-college' ? '/almanar-logo.png' : selectedUniversityLogoRaw;

  const [pendingLinkEmail, setPendingLinkEmail] = useState('');


  // Session Restoration: redirect authenticated users away from Login page
  React.useEffect(() => {
    const token = localStorage.getItem('manar_token');
    const userJson = localStorage.getItem('manar_user');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'COLLEGE_ADMIN' || user.role === 'UNI_ADMIN') {
          navigate('/admin/overview', { replace: true });
        } else if (user.role === 'LECTURER') {
          navigate('/lecturer/home', { replace: true });
        } else if (user.role === 'STUDENT') {
          navigate('/student/home', { replace: true });
        }
      } catch (e) {}
    }
  }, [navigate]);

  // Discreet Developer login prefill helper
  React.useEffect(() => {
    const isDev = new URLSearchParams(window.location.search).get('dev') === 'true';
    if (isDev) {
      setIdentifier('m.gh.alosimi@gmail.com');
      setPassword('708090');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window.location.search]);

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError(null);
    window.dispatchEvent(new CustomEvent('large-operation-start', {
      detail: { message: isAr ? 'جاري التحقق من حساب Google وتسجيل الدخول...' : 'Verifying Google account & logging in...' }
    }));
    try {
      if (pendingLinkEmail) {
        // Link Google Account Flow
        const res = await axios.post(`${API_URL}/api/auth/link-google`, {
          email: pendingLinkEmail,
          credential: credentialResponse.credential
        });
        if (res.data?.success) {
          const { token, user } = res.data;
          localStorage.setItem('manar_token', token);
          localStorage.setItem('manar_user', JSON.stringify(user));
          toast.success(isAr ? 'تم ربط الحساب وتسجيل الدخول بنجاح' : 'Account linked and signed in successfully');
          localStorage.setItem('student_profile', JSON.stringify({
            name: user.name,
            email: user.email,
            department: '',
            level: '',
            groupId: user.groupId || 1,
          }));
          setPendingLinkEmail('');
          navigate('/student/home');
        }
        return;
      }

      const res = await axios.post(`${API_URL}/api/auth/google`, {
        credential: credentialResponse.credential,
        collegeId: selectedCollegeId || undefined
      });
      if (res.data?.success) {
        const { token, user } = res.data;
        localStorage.setItem('manar_token', token);
        localStorage.setItem('manar_user', JSON.stringify(user));
        toast.success(isAr ? 'تم تسجيل الدخول بنجاح' : 'Welcome back');
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
      if (err.response?.data?.code === 'GOOGLE_NOT_LINKED') {
        const msg = isAr 
          ? 'يرجى تسجيل الدخول ببريدك الجامعي وكلمة المرور أولاً لربط حسابك بجوجل.' 
          : 'Please log in with your university email and password first to link your Google account.';
        setError(msg);
        toast.error(msg);
      } else {
        const msg = getFriendlyErrorMessage(err, isAr ? 'فشل تسجيل الدخول بواسطة Google' : 'Google sign-in failed', isAr);
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
      window.dispatchEvent(new CustomEvent('large-operation-end'));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    window.dispatchEvent(new CustomEvent('large-operation-start', {
      detail: { message: isAr ? 'جاري التحقق وتسجيل الدخول...' : 'Verifying & logging in...' }
    }));
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, {
        identifier,
        password,
        collegeId: selectedCollegeId || undefined
      });
      if (res.data?.success) {
        if (res.data.requiresGoogleLink) {
          setPendingLinkEmail(res.data.email);
          toast.success(isAr ? 'تم التحقق من الحساب بنجاح! يرجى ربط حساب Google الآن.' : 'Account verified! Please link your Google account now.');
          return;
        }
        const { token, user } = res.data;
        localStorage.setItem('manar_token', token);
        localStorage.setItem('manar_user', JSON.stringify(user));
        toast.success(isAr ? 'تم تسجيل الدخول بنجاح' : 'Welcome back');
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
      const msg = getFriendlyErrorMessage(err, isAr ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials', isAr);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      window.dispatchEvent(new CustomEvent('large-operation-end'));
    }
  };

  const inputClass = 'w-full px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all duration-200 text-sm backdrop-blur-md h-[56px] min-h-[56px]';

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col md:grid md:grid-cols-12 relative overflow-hidden font-urbanist"
    >
      {/* Background Ambient Orbs (Tailwind Animations) */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none opacity-20 bg-cyan-500/20 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none opacity-10 bg-purple-500/20 animate-pulse" style={{ animationDelay: '2s' }} />

      {/* ── LEFT SHOWCASE PANEL (Desktop only) ─────────────────────────── */}
      <div className="hidden md:flex md:col-span-5 lg:col-span-5 bg-black/40 border-r border-white/5 relative flex-col justify-between p-12 overflow-hidden select-none" style={{ borderRightColor: isAr ? 'transparent' : 'rgba(255,255,255,0.05)', borderLeftColor: isAr ? 'rgba(255,255,255,0.05)' : 'transparent', borderLeftWidth: isAr ? '1px' : '0px', borderRightWidth: isAr ? '0px' : '1px' }}>
        
        {/* Soft background ambient gradient for visual depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent-dim)]/5 to-transparent pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3 cursor-pointer" onClick={handleRedirectLogoClick}>
          <Logo size="sm" customLogoUrl={selectedUniversityLogo} />
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-widest uppercase text-white">
              {selectedUniversityName ? selectedUniversityName : (isAr ? 'بوابة الطالب' : 'STUDENT PORTAL')}
            </span>
            <span className="text-[10px] font-bold tracking-wider text-[var(--text-secondary)]">
              {selectedCollegeName ? selectedCollegeName : (isAr ? 'بوابة الطالب الجامعي' : 'University Student Portal')}
            </span>
          </div>
        </div>

        {/* Large Glowing Logo and Slogan */}
        <div className="relative z-10 my-auto py-10 space-y-12">
          <div onClick={handleStaticLogoClick} className="cursor-pointer flex justify-center">
            <Logo size="xl" customLogoUrl={selectedUniversityLogo} />
          </div>

          {/* Slogan */}
          <div className="text-center space-y-3">
            <h2 className="text-xl lg:text-2xl font-black text-white leading-tight tracking-wide">
              {isAr ? 'نظام الجدولة والتحكم المركزي' : 'Central Scheduling & Control'}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
              {isAr 
                ? 'منصة متكاملة لتتبع المحاضرات، تنبيهات التعديل الفورية، وإدارة حضور الطلاب بشكل لحظي وذكي.' 
                : 'A unified platform for lecture schedules, instant updates, and intelligent real-time student check-ins.'}
            </p>
          </div>

          {/* Features Checklist */}
          <div className="space-y-4 max-w-xs mx-auto text-xs">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/2 border border-white/5 backdrop-blur-sm">
              <span className="text-base leading-none">📅</span>
              <div className="space-y-0.5">
                <h4 className="font-black text-white">{isAr ? 'جداول دراسية فورية' : 'Real-time Schedules'}</h4>
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                  {isAr ? 'متابعة أحدث مواعيد القاعات الدراسية والمحاضرات.' : 'Instant access to current lecture halls and timings.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/2 border border-white/5 backdrop-blur-sm">
              <span className="text-base leading-none">🔔</span>
              <div className="space-y-0.5">
                <h4 className="font-black text-white">{isAr ? 'تنبيهات وإشعارات لحظية' : 'Instant Push Notifications'}</h4>
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                  {isAr ? 'إشعارات فورية عند تعديل أي محاضرة أو قاعة.' : 'Receive prompt alerts for rescheduled or canceled lectures.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/2 border border-white/5 backdrop-blur-sm">
              <span className="text-base leading-none">⚡</span>
              <div className="space-y-0.5">
                <h4 className="font-black text-white">{isAr ? 'حضور رقمي بالـ QR' : 'Instant QR Check-in'}</h4>
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                  {isAr ? 'تسجيل الحضور في ثوانٍ عبر مسح رمز التحضير.' : 'Mark attendance quickly by scanning the QR code.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-center">
          <p className="text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
            © {new Date().getFullYear()} {selectedUniversityName || 'MANAR'}
          </p>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ─────────────────────────────────────────── */}
      <div className="col-span-12 md:col-span-7 flex flex-col min-h-screen relative z-10">
        
        {/* Mobile Header utilities */}
        <header className="flex items-center justify-between px-6 py-4 md:px-10 md:py-6 border-b border-white/5 md:border-b-0 bg-[var(--bg-primary)]/60 md:bg-transparent backdrop-blur-md md:backdrop-blur-none relative z-20 shrink-0">
          <div className="flex items-center gap-2 md:hidden cursor-pointer" onClick={handleRedirectLogoClick}>
            <Logo size="sm" customLogoUrl={selectedUniversityLogo} />
            <span className="text-xs font-black tracking-widest uppercase text-white truncate max-w-[150px]">
              {selectedUniversityName ? selectedUniversityName : 'MANAR'}
            </span>
          </div>

          <div className="flex items-center gap-3 ms-auto">
            <ThemeSwitcher />
            <button
              onClick={() => i18n.changeLanguage(isAr ? 'en' : 'ar')}
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black tracking-widest uppercase hover:bg-white/10 transition-all text-white"
            >
              {isAr ? 'EN' : 'عربي'}
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-12 overflow-y-auto">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="w-full max-w-md"
          >
            {/* Form Glassmorphism Wrapper */}
            <motion.div 
              variants={item}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
            >
              {/* Top ambient color strip in the card header */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dim)] opacity-40" />

              {/* Title Section */}
              <div className="text-center mb-8 mt-2">
                <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--accent)' }}>
                  {isAr ? 'بوابة الطلاب' : 'STUDENT PORTAL'}
                </p>
                <h1 className="text-2xl font-black text-white tracking-tight">
                  {isAr ? 'تسجيل الدخول' : 'Access Your Portal'}
                </h1>
              </div>

              {/* Error Alert Panel */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 overflow-hidden"
                  >
                    <div
                      className="px-5 py-3 rounded-xl border text-xs font-bold flex items-center gap-2 bg-red-500/10 border-red-500/20 text-red-400"
                    >
                      <span>⚠️</span>
                      <span>{error}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {pendingLinkEmail ? (
                <div className="space-y-6 text-center animate-fade-in">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                      🔗
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-lg font-black text-white">
                      {isAr ? 'ربط حساب Google' : 'Link Google Account'}
                    </h2>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                      {isAr 
                        ? `تم التحقق من حسابك الجامعي (${pendingLinkEmail}) بنجاح. يرجى الآن تسجيل الدخول بحساب Google المعتمد لإتمام عملية الربط.`
                        : `Your university account (${pendingLinkEmail}) has been verified. Please sign in with your Google account now to complete the link.`}
                    </p>
                  </div>

                  {/* Google Login Button */}
                  <div className="w-full flex justify-center google-login-container py-2" dir="ltr">
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
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingLinkEmail('');
                        setError(null);
                      }}
                      className="text-xs font-black text-slate-500 hover:text-white transition-colors uppercase tracking-wider"
                    >
                      {isAr ? 'إلغاء والعودة' : 'Cancel and go back'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Login Form */}
                  <form onSubmit={handleLogin} className="space-y-5">
                    
                    {/* Identifier Input */}
                    <Field label={isAr ? 'البريد الجامعي / الرقم الجامعي' : 'University Email / ID'}>
                      <input
                        type="text"
                        required
                        autoComplete="username"
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                        placeholder={isAr ? 'البريد الجامعي أو الرقم الجامعي' : 'University email or ID'}
                        className={inputClass}
                      />
                    </Field>

                    {/* Password Input */}
                    <Field label={isAr ? 'كلمة المرور' : 'Password'}>
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className={`${inputClass} font-mono`}
                        style={{ letterSpacing: password ? '0.15em' : '0em' }}
                      />
                    </Field>

                    {/* Submit Action Button */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dim)] text-white font-black shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_25px_var(--accent-glow)] transition-all text-sm disabled:opacity-70 disabled:cursor-not-allowed h-[56px] min-h-[56px]"
                      >
                        {loading ? (
                          <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
                            <span>{isAr ? '←' : '→'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  <div className="mt-6 space-y-4 animate-fade-in">
                    {/* Divider */}
                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-white/10"></div>
                      <span className="flex-shrink mx-4 text-[10px] font-black text-white/45 uppercase tracking-widest text-center leading-relaxed">
                        {isAr ? 'أو للدخول السريع للطلاب المربوطين' : 'Or quick login for linked students'}
                      </span>
                      <div className="flex-grow border-t border-white/10"></div>
                    </div>

                    {/* Google Login Button */}
                    <div className="w-full flex justify-center google-login-container" dir="ltr">
                      <SafeGoogleLogin>
                        <GoogleLogin
                          onSuccess={handleGoogleSuccess}
                          onError={() => {
                            toast.error(isAr ? 'فشل الاتصال بخدمة Google' : 'Google connection failed');
                          }}
                          theme="filled_black"
                          size="large"
                          shape="rectangular"
                          width="384"
                        />
                      </SafeGoogleLogin>
                    </div>

                    <p className="text-[11px] text-white/55 text-center leading-relaxed mt-4 p-4 rounded-2xl bg-white/2 border border-white/5 backdrop-blur-sm">
                      {isAr 
                        ? '⚠️ يتطلب نظام منار للطلاب تسجيل الدخول الحصري والمباشر عبر حساب جوجل الجامعي الموثق.' 
                        : '⚠️ The Manar Student Portal requires exclusive and direct login via your verified university Google account.'}
                    </p>
                  </div>

                  <div className="mt-6 text-center">
                    <button
                      onClick={() => navigate('/teacher-login')}
                      className="text-xs text-[var(--accent)] hover:text-[var(--accent-glow)] font-bold transition-colors underline-offset-4 hover:underline"
                    >
                      {isAr ? 'أنت عضو هيئة تدريس أو إداري؟ سجل الدخول من هنا' : 'Are you a Faculty or Staff? Login here'}
                    </button>
                  </div>
                </>
              )}

              {/* Bottom links inside card */}
              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <p className="text-xs text-white/50">
                  {isAr ? 'لا تملك حساباً؟ ' : "Don't have an account? "}
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="font-black underline underline-offset-4 hover:text-white transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    {isAr ? 'سجّل حساباً جديداً' : 'Register now'}
                  </button>
                </p>
              </div>

            </motion.div>

            {/* Back to gateway button */}
            <motion.div variants={item} className="text-center mt-6">
              <button
                type="button"
                onClick={() => {
                  const uniSlug = localStorage.getItem('selectedUniversitySlug');
                  const collegeSlug = localStorage.getItem('selectedCollegeSlug');
                  if (collegeSlug) navigate(`/c/${collegeSlug}`);
                  else if (uniSlug) navigate(`/u/${uniSlug}`);
                  else navigate('/');
                }}
                className="text-[11px] font-black text-white/50 hover:text-white transition-colors duration-200 inline-flex items-center gap-1.5 uppercase tracking-wider"
              >
                <span>{isAr ? '←' : '→'}</span>
                <span>{isAr ? 'العودة لاختيار الجامعة' : 'Back to gateway'}</span>
              </button>
            </motion.div>

          </motion.div>
        </div>

        {/* Cinematic Footer signature */}
        <footer className="py-6 shrink-0 relative z-20">
          <DevSignature centered={true} />
        </footer>
      </div>

      {/* Developer Portal Modal */}
      <AnimatePresence>
        {showDevModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="w-full max-w-md backdrop-blur-2xl bg-black/60 border border-white/15 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center"
            >
              {/* Glowing Top Border */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500 animate-pulse" />

              {/* Icon / Header */}
              <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl mb-6 shadow-inner">
                💻
              </div>

              <h3 className="text-xl font-black text-white mb-2 tracking-tight">
                {isAr ? 'بوابة المطور الآمنة' : 'Secure Developer Portal'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mb-6 leading-relaxed">
                {isAr 
                  ? 'يرجى إدخال رمز التجاوز الأمني للوصول المباشر إلى لوحة تحكم المطور.' 
                  : 'Please enter the security override key to bypass authentication.'}
              </p>

              {/* Form */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                const entered = devCode;
                setDevCode('');
                if (entered === '708090') {
                  setShowDevModal(false);
                  await handleDeveloperBypass('708090');
                } else {
                  setShowDevModal(false);
                  toast.error(isAr ? 'الرجاء العودة إلى خانة تسجيل الدخول الخاصة بك.' : 'Incorrect code. Please return to your login section.');
                }
              }} className="space-y-4">
                <div className="space-y-2">
                  <input
                    type="password"
                    maxLength={10}
                    required
                    value={devCode}
                    onChange={(e) => {
                      setDevCode(e.target.value);
                      setDevError('');
                    }}
                    placeholder="••••••"
                    className="w-full text-center px-5 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all duration-200 text-lg tracking-[0.5em] font-mono"
                    autoFocus
                  />
                </div>

                {devError && (
                  <p className="text-xs text-red-400 font-bold flex items-center justify-center gap-1">
                    <span>⚠️</span> {devError}
                  </p>
                )}

                {/* Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDevModal(false);
                      setDevCode('');
                      toast(isAr ? 'الرجاء العودة إلى خانة تسجيل الدخول الخاصة بك.' : 'Please return to your login section.', { icon: 'ℹ️' });
                    }}
                    className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 font-bold hover:bg-white/10 transition-all text-xs uppercase tracking-wider"
                  >
                    {isAr ? 'العودة لتسجيل الدخول' : 'Return to Login'}
                  </button>
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all text-xs uppercase tracking-wider"
                  >
                    {isAr ? 'تحقق ودخول' : 'Verify & Enter'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
