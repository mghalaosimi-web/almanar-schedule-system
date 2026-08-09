import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, GOOGLE_CLIENT_ID } from './config';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import ThemeSwitcher from './ThemeSwitcher';
import Logo from './Logo';
import DevSignature from './DevSignature';
import { staticData, staticLevels } from './staticData';
import { getFriendlyErrorMessage } from './utils/errorHelpers';
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

/* ── Animation variants ───────────────────────────────────────── */
const wizardVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction) => ({
    zIndex: 0,
    x: direction < 0 ? 40 : -40,
    opacity: 0
  })
};

const Field = ({ label, children }) => (
  <div className="space-y-1.5 text-right">
    <label className="block text-[11px] font-black tracking-wider uppercase text-[var(--text-secondary)]">
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

  const [isPrefilledState, setIsPrefilledState] = useState(
    !!(location.state?.prefilledData || (localStorage.getItem('selectedCollegeId') && localStorage.getItem('preselectedMajorId')))
  );

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

  const selectedCollegeId = localStorage.getItem('selectedCollegeId') || '3';
  const selectedCollegeName = localStorage.getItem('selectedCollegeName') || 'كلية المنار الجامعية';
  const selectedUniversityName = localStorage.getItem('selectedUniversityName') || 'كلية المنار الجامعية';
  const selectedUniversityLogo = '/almanar-logo.png';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load static data locally
  const uniConfig = staticData['almanar-college'];
  const activeCollege = uniConfig.colleges?.[0];

  const departmentsList = activeCollege?.departments || [];
  const activeDept = departmentsList.find(d => d.id === parseInt(selectedDeptId));
  const majorsList = activeDept?.majors || [];
  const levelsList = staticLevels;

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
      setIsPrefilledState(true);
    }
  }, [location.state]);

  // Automatically resolve department from selectedMajorId
  useEffect(() => {
    if (selectedMajorId && activeCollege?.departments) {
      const dept = activeCollege.departments.find(d => 
        d.majors?.some(m => m.id === parseInt(selectedMajorId))
      );
      if (dept) {
        setSelectedDeptId(dept.id.toString());
      }
    }
  }, [selectedMajorId, activeCollege]);

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
      if (isPrefilledState) {
        setDirection(1);
        setStep(3);
        return;
      }
    }
    if (step === 2) {
      if ((!isPrefilledState && !selectedDeptId) || !selectedMajorId) {
        toast.error(isAr ? 'يرجى إكمال البيانات الأكاديمية' : 'Please complete academic details');
        return;
      }
    }
    setDirection(1);
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    if (step === 3 && isPrefilledState) {
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
        majorId: selectedMajorId,
        levelId: selectedLevelId,
        collegeId: selectedCollegeId,
        googleIdToken: isGoogleLinked ? googleIdToken : undefined,
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

  const inputClass = 'w-full text-xs font-bold rounded-xl px-4 py-3 transition-all focus:outline-none focus:ring-1 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] placeholder-[var(--text-muted)]';
  const selectClass = `${inputClass} appearance-none cursor-pointer pr-10 pl-4`;

  const progressPercentage = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col items-center justify-start relative overflow-hidden"
      style={{ fontFamily: 'var(--font-family, "Urbanist", "Cairo", sans-serif)' }}
    >
      {/* Centered Mobile-First Container (max 480px) */}
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen relative shadow-2xl border-x border-[var(--border-color)]">

        {/* ── Top Header Bar ─────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 bg-[var(--bg-card)] border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate('/')} className="shrink-0 focus:outline-none select-none">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--border-color)] flex items-center justify-center overflow-hidden">
                <img src="/almanar-logo.png" alt="المنار" className="w-full h-full object-contain" />
              </div>
            </button>

            <div className="flex-1 min-w-0 text-right">
              <p className="text-sm font-black text-[var(--text-primary)] truncate">{selectedCollegeName}</p>
              <p className="text-[10px] text-[var(--text-muted)] font-bold truncate">
                {isAr ? 'إنشاء حساب طالب جديد' : 'New Student Registration'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <ThemeSwitcher />
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

        {/* ── Main Registration Card Area ───────────────────────────────── */}
        <main className="flex-1 flex flex-col justify-center px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-2xl relative overflow-hidden"
          >
            {/* Top Glowing Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--border-color)]">
              <motion.div 
                className="h-full"
                style={{ background: 'var(--accent)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              />
            </div>

            {/* Title Section */}
            <div className="text-center mb-6 mt-2">
              <p className="text-[10px] font-black tracking-widest uppercase mb-1.5" style={{ color: 'var(--accent)' }}>
                {isAr ? `الخطوة ${step} من 3` : `STEP ${step} OF 3`}
              </p>
              <h1 className="text-lg font-black text-[var(--text-primary)]">
                {step === 1 && (isAr ? 'المعلومات الشخصية' : 'Personal Information')}
                {step === 2 && (isAr ? 'البرنامج الأكاديمي' : 'Academic Program')}
                {step === 3 && (isAr ? 'تأكيد الحساب والأمان' : 'Account Security & Auth')}
              </h1>

              {/* Institution badge */}
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[var(--accent-dim)] border border-[var(--accent-glow)] text-xs font-black" style={{ color: 'var(--accent)' }}>
                  🏫 {selectedCollegeName}
                </span>
                {localStorage.getItem('preselectedMajorName') && (
                  <span className="px-3 py-1 rounded-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)]">
                    📖 {localStorage.getItem('preselectedMajorName')}
                  </span>
                )}
              </div>
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
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
                    <span>⚠️</span>
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Wizard Steps Slider */}
            <div className="relative min-h-[300px]">
              <AnimatePresence custom={direction} mode="wait">
                <motion.div
                  key={step}
                  custom={direction}
                  variants={wizardVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2 }}
                  className="w-full space-y-4"
                >
                  {/* ── STEP 1: Personal Info ────────────────────────── */}
                  {step === 1 && (
                    <div className="space-y-3.5">
                      <Field label={isAr ? 'الاسم الكامل للطالب' : 'Full Name'}>
                        <input 
                          type="text" 
                          required 
                          value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          placeholder={isAr ? 'أدخل الاسم الرباعي المعتمد' : 'Four-part full name'}
                          className={inputClass} 
                        />
                      </Field>

                      <Field label={isAr ? 'رقم الهاتف' : 'Phone Number'}>
                        <div className="flex overflow-hidden relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)]">
                          <span className="px-3.5 flex items-center text-xs font-black border-r border-[var(--border-color)] text-[var(--text-secondary)] bg-[var(--bg-card)]" dir="ltr">
                            +967
                          </span>
                          <input 
                            type="tel" 
                            required 
                            value={phoneSuffix}
                            onChange={e => { const v = e.target.value.replace(/\D/g,''); if (v.length <= 9) setPhoneSuffix(v); }}
                            placeholder="7XXXXXXXX"
                            className="flex-1 bg-transparent px-3.5 py-3 focus:outline-none font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                            dir="ltr" 
                          />
                        </div>
                      </Field>

                      <Field label={isAr ? 'الرقم الجامعي (اختياري)' : 'Student ID Number (Optional)'}>
                        <input 
                          type="text" 
                          value={idNumber}
                          onChange={e => setIdNumber(e.target.value)}
                          placeholder={isAr ? 'أرقام فقط (مثال: 20241001)' : 'Digits only'}
                          className={`${inputClass} font-mono`} 
                        />
                      </Field>

                      <Field label={isAr ? 'المستوى الدراسي' : 'Academic Level'}>
                        <div className="relative flex items-center">
                          <select 
                            required 
                            value={selectedLevelId}
                            onChange={e => setSelectedLevelId(e.target.value)}
                            className={selectClass}
                          >
                            <option value="">{isAr ? '— اختر المستوى —' : '— Select Level —'}</option>
                            {levelsList.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                          <div className={`absolute ${isAr ? 'left-3' : 'right-3'} pointer-events-none text-xs text-[var(--text-muted)]`}>
                            ▼
                          </div>
                        </div>
                      </Field>
                    </div>
                  )}

                  {/* ── STEP 2: Academic Info ───────────────────────── */}
                  {step === 2 && (
                    <div className="space-y-3.5">
                      <Field label={isAr ? 'القسم الأكاديمي' : 'Department'}>
                        <div className="relative flex items-center">
                          <select 
                            required 
                            value={selectedDeptId}
                            onChange={e => setSelectedDeptId(e.target.value)}
                            className={selectClass}
                          >
                            <option value="">{isAr ? '— اختر القسم —' : '— Select Department —'}</option>
                            {departmentsList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                          <div className={`absolute ${isAr ? 'left-3' : 'right-3'} pointer-events-none text-xs text-[var(--text-muted)]`}>
                            ▼
                          </div>
                        </div>
                      </Field>

                      <Field label={isAr ? 'التخصص الدراسي' : 'Specialization'}>
                        <div className="relative flex items-center">
                          <select 
                            required 
                            disabled={!selectedDeptId} 
                            value={selectedMajorId}
                            onChange={e => setSelectedMajorId(e.target.value)}
                            className={`${selectClass} disabled:opacity-40`}
                          >
                            <option value="">{isAr ? '— اختر التخصص —' : '— Select Major —'}</option>
                            {majorsList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                          <div className={`absolute ${isAr ? 'left-3' : 'right-3'} pointer-events-none text-xs text-[var(--text-muted)]`}>
                            ▼
                          </div>
                        </div>
                      </Field>
                    </div>
                  )}

                  {/* ── STEP 3: Verification & Security ─────────────── */}
                  {step === 3 && (
                    <div className="space-y-4 text-center">
                      <div className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] space-y-3">
                        <h4 className="font-black text-xs text-[var(--text-primary)]">
                          {isAr ? 'ربط وتوثيق حساب Google الجامعي' : 'Link & Verify Google Account'}
                        </h4>
                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed max-w-xs mx-auto">
                          {isAr 
                            ? 'يرجى ربط حساب Google الخاص بك لتسجيل الدخول الفوري دون حاجة لكلمة مرور.'
                            : 'Link your Google account for 1-click instant login.'}
                        </p>

                        {isGoogleLinked ? (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2">
                            <span>✅</span>
                            <span>{isAr ? `مرتبط وموثق: ${googleEmail}` : `Linked: ${googleEmail}`}</span>
                          </div>
                        ) : (
                          <div className="w-full flex justify-center google-login-container pt-1" dir="ltr">
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
                                  width="320"
                                />
                              </SafeGoogleLogin>
                            </GoogleOAuthProvider>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Step Actions */}
            <div className="pt-4 mt-3 border-t border-[var(--border-color)] flex items-center justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] font-bold text-xs hover:bg-[var(--border-color)] transition-colors cursor-pointer"
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
                  className="px-6 py-2.5 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  style={{ background: 'var(--accent)', color: '#000' }}
                >
                  <span>{isAr ? 'التالي' : 'Next'}</span>
                  <span>{isAr ? '←' : '→'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#000' }}
                >
                  {loading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  ) : (
                    <>
                      <span>{isAr ? 'إنشاء الحساب' : 'Create Account'}</span>
                      <span>🚀</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Back to Sign In */}
            <p className="text-center text-xs text-[var(--text-muted)] font-bold mt-4">
              {isAr ? 'لديك حساب بالفعل؟ ' : 'Already have an account? '}
              <button 
                type="button" 
                onClick={() => navigate('/')}
                className="font-black underline transition-colors"
                style={{ color: 'var(--accent)' }}
              >
                {isAr ? 'تسجيل الدخول' : 'Sign in'}
              </button>
            </p>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="border-t border-[var(--border-color)] py-3 bg-[var(--bg-card)] text-center shrink-0">
          <DevSignature centered={true} />
        </footer>
      </div>
    </div>
  );
}
