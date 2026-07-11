import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from './config';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import ThemeSwitcher from './ThemeSwitcher';
import Logo from './Logo';
import DevSignature from './DevSignature';
import { staticData, staticLevels } from './staticData';
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
const wizardVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction) => ({
    zIndex: 0,
    x: direction < 0 ? 50 : -50,
    opacity: 0
  })
};

const Field = ({ label, children }) => (
  <div className="space-y-2">
    <label className="block text-[10px] font-black tracking-wider uppercase text-white/50">
      {label}
    </label>
    {children}
  </div>
);

export default function Register() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();

  // Wizard State
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(0);

  // Form State
  const [fullName, setFullName] = useState(location.state?.googleName || '');
  const [email, setEmail] = useState(location.state?.googleEmail || '');
  const [password, setPassword] = useState('');
  const [phoneSuffix, setPhoneSuffix] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idPhotoUrl, setIdPhotoUrl] = useState('');

  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedMajorId, setSelectedMajorId] = useState(localStorage.getItem('preselectedMajorId') || '');
  const [selectedLevelId, setSelectedLevelId] = useState('');

  // Google Login Auth State
  const [googleIdToken, setGoogleIdToken] = useState(location.state?.googleIdToken || '');
  const [googleEmail, setGoogleEmail] = useState(location.state?.googleEmail || '');
  const [isGoogleLinked, setIsGoogleLinked] = useState(!!location.state?.googleIdToken);
  const [usePasswordAuth, setUsePasswordAuth] = useState(false);

  // Captcha & OTP State
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaChallengeId, setCaptchaChallengeId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);

  const selectedCollegeId = localStorage.getItem('selectedCollegeId');
  const selectedCollegeName = localStorage.getItem('selectedCollegeName');
  const selectedUniversityName = localStorage.getItem('selectedUniversityName');
  const selectedUniversityLogoRaw = localStorage.getItem('selectedUniversityLogo');
  const selectedUniversitySlug = localStorage.getItem('selectedUniversitySlug') || 'almanar-college';
  const selectedUniversityLogo = selectedUniversitySlug === 'hajjah-university' ? '/hajjah-logo-new.png' :
                                 selectedUniversitySlug === 'almanar-college' ? '/almanar-logo.png' : selectedUniversityLogoRaw;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load static data locally
  const uniConfig = staticData[selectedUniversitySlug] || staticData['almanar-college'];
  const activeCollege = uniConfig.colleges?.find(c => c.id === parseInt(selectedCollegeId)) || uniConfig.colleges?.[0];

  const departmentsList = activeCollege?.departments || [];
  const activeDept = departmentsList.find(d => d.id === parseInt(selectedDeptId));
  const majorsList = activeDept?.majors || [];
  const groupsList = activeCollege?.groups || [];
  const levelsList = selectedUniversitySlug === 'health-institute'
    ? staticLevels.filter(l => l.name === 'Level 1' || l.name === 'Level 2' || l.name === 'Level 3')
    : staticLevels;

  const fetchCaptcha = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/auth/captcha`);
      if (res.data?.success) {
        setCaptchaQuestion(res.data.question);
        setCaptchaChallengeId(res.data.challengeId);
        setCaptchaAnswer('');
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  // Session Restoration Redirect
  useEffect(() => {
    const token = localStorage.getItem('manar_token');
    const userJson = localStorage.getItem('manar_user');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
          navigate('/admin/overview', { replace: true });
        } else if (user.role === 'LECTURER') {
          navigate('/lecturer/home', { replace: true });
        } else if (user.role === 'STUDENT') {
          navigate('/student/home', { replace: true });
        }
      } catch (e) {}
    }
  }, [navigate]);

  useEffect(() => {
    const prefilled = location.state?.prefilledData;
    if (prefilled) {
      if (prefilled.majorId) {
        setSelectedMajorId(prefilled.majorId.toString());
      }
      if (prefilled.collegeId) {
        localStorage.setItem('selectedCollegeId', prefilled.collegeId.toString());
      }
    }
  }, [location.state]);

  // Timer logic for OTP
  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendOTP = async () => {
    if (phoneSuffix.length < 9) {
      toast.error(isAr ? 'الرجاء إدخال رقم هاتف صحيح' : 'Please enter a valid phone number');
      return;
    }
    setOtpLoading(true);
    try {
      const formattedPhone = `+967${phoneSuffix}`;
      const res = await axios.post(`${API_URL}/api/auth/send-otp`, { phone: formattedPhone, email: email });
      if (res.data?.success) {
        setOtpSent(true);
        setTimer(60);
        toast.success(isAr ? 'تم إرسال رمز التحقق بنجاح!' : 'Verification OTP sent successfully!');
      }
    } catch (err) {
      const msg = getFriendlyErrorMessage(err, isAr ? 'فشل في إرسال الرمز' : 'Failed to send OTP', isAr);
      toast.error(msg);
    } finally {
      setOtpLoading(false);
    }
  };

  const parseJwt = (token) => {
    try {
      return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (e) {
      return null;
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const payload = parseJwt(credentialResponse.credential);
      if (!payload || !payload.email) {
        throw new Error('Invalid JWT payload');
      }
      const mockEmail = payload.email;
      const mockName = payload.name || payload.given_name || mockEmail.split('@')[0];

      setGoogleEmail(mockEmail);
      setEmail(mockEmail);
      if (!fullName) setFullName(mockName);
      setGoogleIdToken(credentialResponse.credential);
      setIsGoogleLinked(true);
      toast.success(isAr ? `تم ربط الحساب: ${mockEmail}` : `Linked Google Account: ${mockEmail}`);
    } catch (err) {
      console.error('[GOOGLE LINK] Failed to parse credential:', err);
      const msg = getFriendlyErrorMessage(err, isAr ? 'فشل جلب بيانات Google' : 'Failed to fetch Google profile', isAr);
      toast.error(msg);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!fullName || !phoneSuffix) {
        toast.error(isAr ? 'يرجى ملء الحقول الإلزامية' : 'Please fill all required fields');
        return;
      }
      const nameParts = fullName.trim().split(/\s+/);
      if (nameParts.length < 3) {
        toast.error(isAr ? 'يرجى إدخال الاسم الثلاثي أو الرباعي الكامل' : 'Please enter at least your triple or quadruple full name');
        return;
      }
      if (phoneSuffix.length !== 9 || !/^\d+$/.test(phoneSuffix)) {
        toast.error(isAr ? 'رقم الهاتف يجب أن يتكون من 9 أرقام تماماً' : 'Phone number must be exactly 9 digits');
        return;
      }
      if (idNumber.trim() !== '' && (!/^\d+$/.test(idNumber.trim()) || idNumber.trim().length < 5)) {
        toast.error(isAr ? 'الرقم الجامعي يجب أن يتكون من أرقام فقط ولا يقل عن 5 خانات' : 'University ID must be digits only and at least 5 digits long');
        return;
      }
      if (!selectedLevelId) {
        toast.error(isAr ? 'يرجى اختيار المستوى الدراسي' : 'Please select your academic level');
        return;
      }
      if (location.state?.prefilledData) {
        setDirection(1);
        setStep(3);
        return;
      }
    }
    if (step === 2) {
      const isPrefilled = !!location.state?.prefilledData;
      if ((!isPrefilled && !selectedDeptId) || !selectedMajorId) {
        toast.error(isAr ? 'يرجى إكمال البيانات الأكاديمية' : 'Please complete academic details');
        return;
      }
    }
    setDirection(1);
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    if (step === 3 && location.state?.prefilledData) {
      setDirection(-1);
      setStep(1);
      return;
    }
    setDirection(-1);
    setStep((prev) => prev - 1);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    if (!isGoogleLinked && !usePasswordAuth) {
      toast.error(isAr ? 'الرجاء ربط حساب Google الخاص بك للمتابعة' : 'Please link your Google account to proceed');
      return;
    }

    if (usePasswordAuth) {
      if (!email || !password || !otpSent || !otpCode) {
        toast.error(isAr ? 'الرجاء إدخال البريد الإلكتروني وكلمة المرور ورمز التحقق (OTP)' : 'Please enter email, password, and OTP code');
        return;
      }
      if (!captchaAnswer) {
        toast.error(isAr ? 'الرجاء حل التحقق البشري' : 'Please complete captcha');
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        fullName,
        email: isGoogleLinked ? googleEmail : email,
        password: usePasswordAuth ? password : undefined,
        phone: `+967${phoneSuffix}`,
        idNumber,
        idPhotoUrl: idPhotoUrl || undefined,
        majorId: majorsList.find(m => m.id === parseInt(selectedMajorId))?.name || selectedMajorId,
        levelId: levelsList.find(l => l.id === parseInt(selectedLevelId))?.name || selectedLevelId,
        collegeId: activeCollege?.name || selectedCollegeId,
        googleIdToken: isGoogleLinked ? googleIdToken : undefined,
        captchaAnswer: usePasswordAuth ? captchaAnswer : undefined,
        captchaChallengeId: usePasswordAuth ? captchaChallengeId : undefined,
        otpCode: usePasswordAuth ? otpCode : undefined,
      };

      const res = await axios.post(`${API_URL}/api/auth/register`, payload);
      if (res.data?.success) {
        const { token, user } = res.data;
        localStorage.setItem('manar_token', token);
        localStorage.setItem('manar_user', JSON.stringify(user));
        localStorage.setItem('student_profile', JSON.stringify({
          name: user.name,
          email: user.email,
          phone: `+967${phoneSuffix}`,
          idPhotoUrl: idPhotoUrl || '',
          department: departmentsList.find(d => d.id === parseInt(selectedDeptId))?.name || '',
          level: levelsList.find(l => l.id === parseInt(selectedLevelId))?.name || '',
          groupId: null,
        }));
        toast.success(isAr ? 'تم إنشاء الحساب بنجاح!' : 'Account created successfully!');
        navigate('/student/home');
      }
    } catch (err) {
      const msg = getFriendlyErrorMessage(err, isAr ? 'فشل التسجيل. حاول مجدداً.' : 'Registration failed. Please try again.', isAr);
      setError(msg);
      toast.error(msg);
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all duration-200 text-sm backdrop-blur-md h-[56px] min-h-[56px]';
  const selectClass = `${inputClass} appearance-none cursor-pointer bg-[#0c0c0c]/80 pr-10 pl-5`;

  const progressPercentage = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col md:grid md:grid-cols-12 relative overflow-hidden font-urbanist"
    >
      {/* Background Ambient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none opacity-20 bg-cyan-500/20 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none opacity-10 bg-purple-500/20 animate-pulse" style={{ animationDelay: '2s' }} />

      {/* ── LEFT SHOWCASE PANEL (Desktop only) ─────────────────────────── */}
      <div className="hidden md:flex md:col-span-4 lg:col-span-4 bg-black/40 border-r border-white/5 relative flex-col justify-between p-10 overflow-hidden select-none" style={{ borderRightColor: isAr ? 'transparent' : 'rgba(255,255,255,0.05)', borderLeftColor: isAr ? 'rgba(255,255,255,0.05)' : 'transparent', borderLeftWidth: isAr ? '1px' : '0px', borderRightWidth: isAr ? '0px' : '1px' }}>
        
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent-dim)]/5 to-transparent pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3 cursor-pointer" onClick={() => {
          const uniSlug = localStorage.getItem('selectedUniversitySlug');
          const collegeSlug = localStorage.getItem('selectedCollegeSlug');
          if (collegeSlug) navigate(`/c/${collegeSlug}`);
          else if (uniSlug) navigate(`/u/${uniSlug}`);
          else navigate('/');
        }}>
          <Logo size="sm" customLogoUrl={selectedUniversityLogo} />
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-widest uppercase text-white">
              {selectedUniversityName ? selectedUniversityName : (isAr ? 'بوابة الطالب' : 'STUDENT PORTAL')}
            </span>
            <span className="text-[9px] font-bold tracking-wider text-[var(--text-secondary)]">
              {selectedCollegeName ? selectedCollegeName : (isAr ? 'بوابة الطالب الجامعي' : 'University Student Portal')}
            </span>
          </div>
        </div>

        {/* Dynamic Glowing Logo and Slogan */}
        <div className="relative z-10 my-auto py-6 space-y-8">
          <Logo size="lg" customLogoUrl={selectedUniversityLogo} />

          <div className="text-center space-y-2">
            <h2 className="text-lg font-black text-white leading-tight tracking-wide">
              {isAr ? 'إنشاء حساب طالب جديد' : 'Student Registration'}
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)] max-w-xs mx-auto leading-relaxed">
              {isAr 
                ? 'يرجى ملء النموذج بالبيانات الصحيحة للالتحاق بجدول شعبتك ومسح التحضير الرقمي.' 
                : 'Please fill out the form with correct academic details to join your group schedule.'}
            </p>
          </div>

          {/* Quick Checklist */}
          <div className="space-y-3 max-w-xs mx-auto text-[11px]">
            <div className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 ${step >= 1 ? 'bg-white/10 border-white/20' : 'bg-white/2 border-white/5'}`}>
              <span className={step >= 1 ? 'opacity-100' : 'opacity-50'}>👤</span>
              <span className={`font-bold transition-opacity ${step >= 1 ? 'text-white' : 'text-white/50'}`}>{isAr ? 'المعلومات الشخصية' : 'Personal Info'}</span>
            </div>
            <div className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 ${step >= 2 ? 'bg-white/10 border-white/20' : 'bg-white/2 border-white/5'}`}>
              <span className={step >= 2 ? 'opacity-100' : 'opacity-50'}>📚</span>
              <span className={`font-bold transition-opacity ${step >= 2 ? 'text-white' : 'text-white/50'}`}>{isAr ? 'البيانات الأكاديمية' : 'Academic Info'}</span>
            </div>
            <div className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 ${step >= 3 ? 'bg-white/10 border-white/20' : 'bg-white/2 border-white/5'}`}>
              <span className={step >= 3 ? 'opacity-100' : 'opacity-50'}>🛡️</span>
              <span className={`font-bold transition-opacity ${step >= 3 ? 'text-white' : 'text-white/50'}`}>{isAr ? 'التحقق والأمان' : 'Verification & Security'}</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-center">
          <p className="text-[8px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
            © {new Date().getFullYear()} {selectedUniversityName || 'MANAR'}
          </p>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ─────────────────────────────────────────── */}
      <div className="col-span-12 md:col-span-8 flex flex-col min-h-screen relative z-10">
        
        {/* Mobile Header utilities */}
        <header className="flex items-center justify-between px-6 py-4 md:px-10 md:py-6 border-b border-white/5 md:border-b-0 bg-[var(--bg-primary)]/60 md:bg-transparent backdrop-blur-md md:backdrop-blur-none relative z-20 shrink-0">
          <div className="flex items-center gap-2 md:hidden cursor-pointer" onClick={() => {
            const uniSlug = localStorage.getItem('selectedUniversitySlug');
            const collegeSlug = localStorage.getItem('selectedCollegeSlug');
            if (collegeSlug) navigate(`/c/${collegeSlug}`);
            else if (uniSlug) navigate(`/u/${uniSlug}`);
            else navigate('/');
          }}>
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
        <div className="flex-1 flex items-center justify-center p-6 md:p-10 overflow-y-auto w-full">
          <div className="w-full max-w-2xl relative">
            
            {/* Form Glassmorphism Wrapper */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              
              {/* Progress Bar */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5">
                <motion.div 
                  className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dim)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              </div>

              {/* Title Section */}
              <div className="text-center mb-8 mt-4">
                <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--accent)' }}>
                  {isAr ? `الخطوة ${step} من 3` : `STEP ${step} OF 3`}
                </p>
                <h1 className="text-2xl font-black text-white tracking-tight">
                  {step === 1 && (isAr ? 'المعلومات الشخصية' : 'Personal Information')}
                  {step === 2 && (isAr ? 'البرنامج الأكاديمي' : 'Academic Program')}
                  {step === 3 && (isAr ? 'تأكيد الحساب والأمان' : 'Account Security & Auth')}
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

              {/* Registration Form Wrapper with Slider */}
              <div className="relative overflow-hidden min-h-[350px]">
                <AnimatePresence custom={direction} mode="wait">
                  <motion.div
                    key={step}
                    custom={direction}
                    variants={wizardVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { type: "spring", stiffness: 300, damping: 30 },
                      opacity: { duration: 0.2 }
                    }}
                    className="w-full absolute inset-0 pb-4 overflow-y-auto hide-scrollbar"
                  >
                    {/* ─ STEP 1: Personal Info ──────────────────────────── */}
                    {step === 1 && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Field label={isAr ? 'الاسم الكامل للزائر' : 'Full Name'}>
                            <input 
                              type="text" 
                              required 
                              value={fullName}
                              onChange={e => setFullName(e.target.value)}
                              placeholder={isAr ? 'الاسم الرباعي المعتمد' : 'Four-part full name'}
                              className={inputClass} 
                            />
                          </Field>

                          <Field label={isAr ? 'رقم الهاتف' : 'Phone Number'}>
                            <div className="flex overflow-hidden relative rounded-xl border border-white/10 bg-white/5 backdrop-blur-md focus-within:border-[var(--accent)] transition-all duration-200" style={{ height: '54px' }}>
                              <span className="px-4 flex items-center text-sm font-black border-r border-white/10 text-white/70 bg-black/20"
                                    dir="ltr">
                                +967
                              </span>
                              <input 
                                type="tel" 
                                required 
                                value={phoneSuffix}
                                onChange={e => { const v = e.target.value.replace(/\D/g,''); if (v.length <= 9) setPhoneSuffix(v); }}
                                placeholder="7XXXXXXXX"
                                className="flex-1 bg-transparent px-4 py-2 focus:outline-none font-mono text-sm text-white placeholder-white/30"
                                dir="ltr" 
                              />
                            </div>
                          </Field>

                          <Field label={isAr ? 'الرقم الجامعي / الأكاديمي (اختياري)' : 'Student ID Number (Optional)'}>
                            <input 
                              type="text" 
                              value={idNumber}
                              onChange={e => setIdNumber(e.target.value)}
                              placeholder={isAr ? 'أرقام فقط - 5 خانات على الأقل' : 'Digits only - min 5 digits'}
                              className={`${inputClass} font-mono`} 
                            />
                          </Field>

                          <Field label={isAr ? 'المستوى الدراسي' : 'Academic Level'}>
                            <div className="relative">
                              <select 
                                required 
                                value={selectedLevelId}
                                onChange={e => setSelectedLevelId(e.target.value)}
                                className={selectClass}
                                style={{ height: '54px' }}
                              >
                                <option value="">{isAr ? 'اختر المستوى' : 'Select level'}</option>
                                {levelsList.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                              </select>
                              <div className={`absolute inset-y-0 ${isAr ? 'left-4' : 'right-4'} flex items-center pointer-events-none text-white/50 text-xs`}>
                                ▼
                              </div>
                            </div>
                          </Field>
                        </div>
                      </div>
                    )}

                    {/* ─ STEP 2: Academic Info ─────────────────────────── */}
                    {step === 2 && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          
                          <div className="w-full" style={location.state?.prefilledData ? { display: 'none' } : {}}>
                            <Field label={isAr ? 'الكلية / القسم' : 'Department'}>
                              <div className="relative">
                                <select 
                                  required={!location.state?.prefilledData} 
                                  value={selectedDeptId}
                                  onChange={e => setSelectedDeptId(e.target.value)}
                                  className={selectClass}
                                  style={{ height: '54px' }}
                                >
                                  <option value="">{isAr ? 'اختر القسم' : 'Select department'}</option>
                                  {departmentsList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                                <div className={`absolute inset-y-0 ${isAr ? 'left-4' : 'right-4'} flex items-center pointer-events-none text-white/50 text-xs`}>
                                  ▼
                                </div>
                              </div>
                            </Field>
                          </div>

                          <div className="w-full" style={location.state?.prefilledData ? { display: 'none' } : {}}>
                            <Field label={isAr ? 'التخصص الدراسي' : 'Specialization'}>
                              <div className="relative">
                                <select 
                                  required={!location.state?.prefilledData} 
                                  disabled={!selectedDeptId && !location.state?.prefilledData} 
                                  value={selectedMajorId}
                                  onChange={e => setSelectedMajorId(e.target.value)}
                                  className={`${selectClass} disabled:opacity-30 disabled:cursor-not-allowed`}
                                  style={{ height: '54px' }}
                                >
                                  <option value="">{isAr ? 'اختر التخصص' : 'Select major'}</option>
                                  {majorsList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                                <div className={`absolute inset-y-0 ${isAr ? 'left-4' : 'right-4'} flex items-center pointer-events-none text-white/50 text-xs`}>
                                  ▼
                                </div>
                              </div>
                            </Field>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─ STEP 3: Verification & Security ───────────────── */}
                    {step === 3 && (
                      <div className="space-y-6">
                        <div className="space-y-6">
                          <div className="p-6 rounded-2xl border border-white/10 bg-black/20 text-center space-y-4 shadow-inner">
                            <div className="space-y-1">
                              <h4 className="font-extrabold text-sm text-white">
                                {isAr ? 'ربط وتوثيق حساب Google الجامعي' : 'Link & Verify Google Account'}
                              </h4>
                              <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
                                {isAr 
                                  ? 'يتطلب نظام منار للطلاب ربطاً إلزامياً ومباشراً بحساب Google لتأمين وتفعيل حسابك فوراً دون كلمة مرور.'
                                  : 'The Manar system requires mandatory Google account linking for students to activate your profile instantly without a password.'}
                              </p>
                            </div>

                            {isGoogleLinked ? (
                              <div className="px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center gap-2">
                                <span>✅</span>
                                <span>{isAr ? `مرتبط وموثق: ${googleEmail}` : `Linked & Verified: ${googleEmail}`}</span>
                              </div>
                            ) : (
                              <div className="w-full flex justify-center google-login-container animate-fade-in" dir="ltr">
                                <GoogleLogin
                                  onSuccess={handleGoogleSuccess}
                                  onError={() => {
                                    toast.error(isAr ? 'فشل الاتصال بخدمة Google' : 'Google connection failed');
                                  }}
                                  theme="filled_black"
                                  size="large"
                                  shape="rectangular"
                                  width="320"
                                />
                              </div>
                            )}
                          </div>

                          <p className="text-[11px] text-white/50 text-center leading-relaxed p-4 rounded-2xl bg-white/2 border border-white/5">
                            {isAr 
                              ? '⚠️ ربط حساب جوجل إلزامي لإكمال التسجيل. تسجيل الحسابات التقليدية غير متاح حالياً للطلاب.' 
                              : '⚠️ Linking a Google account is mandatory to complete registration. Traditional registration is currently disabled for students.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation Actions */}
              <div className="pt-6 mt-4 border-t border-white/10 flex items-center justify-between">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-white font-bold hover:bg-white/10 transition-colors text-sm h-[56px] min-h-[56px] flex items-center justify-center"
                  >
                    {isAr ? 'السابق' : 'Back'}
                  </button>
                ) : (
                  <div />
                )}

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dim)] text-white font-black shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_25px_var(--accent-glow)] transition-all text-sm flex items-center justify-center gap-2 h-[56px] min-h-[56px]"
                  >
                    <span>{isAr ? 'التالي' : 'Next Step'}</span>
                    <span>{isAr ? '←' : '→'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dim)] text-white font-black shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_25px_var(--accent-glow)] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed h-[56px] min-h-[56px]"
                  >
                    {loading ? (
                      <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{isAr ? 'إنشاء الحساب' : 'Create Account'}</span>
                        <span>🚀</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Login Link */}
              <p className="text-center text-xs text-white/50 mt-6">
                {isAr ? 'لديك حساب بالفعل؟ ' : 'Already have an account? '}
                <button 
                  type="button" 
                  onClick={() => navigate('/login')}
                  className="font-black underline underline-offset-4 hover:text-white transition-colors"
                  style={{ color: 'var(--accent)' }}
                >
                  {isAr ? 'تسجيل الدخول' : 'Sign in'}
                </button>
              </p>

            </div>

            {/* Back to gateway button */}
            <div className="text-center mt-6">
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
            </div>

          </div>
        </div>

        {/* Cinematic Footer signature */}
        <footer className="py-6 shrink-0 relative z-20">
          <DevSignature centered={true} />
        </footer>
      </div>

    </div>
  );
}
