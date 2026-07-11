import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import ThemeSwitcher from '../ThemeSwitcher';
import Logo from '../Logo';
import DevSignature from '../DevSignature';

export default function GoogleLinkInterceptor() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('manar_token');
  const userJson = localStorage.getItem('manar_user');
  let user = null;
  if (userJson) {
    try {
      user = JSON.parse(userJson);
    } catch (e) {
      console.error(e);
    }
  }

  // Redirect if not logged in, or if already linked
  useEffect(() => {
    if (!token || !user) {
      navigate('/login', { replace: true });
      return;
    }
    if (user.role === 'STUDENT' && user.googleId) {
      navigate('/student/home', { replace: true });
    }
  }, [token, user, navigate]);

  const parseJwt = (token) => {
    try {
      return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (e) {
      return null;
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError(null);
    try {
      const idToken = credentialResponse.credential;
      const res = await axios.post(
        `${API_URL}/api/auth/link-google`,
        { idToken },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        const { token: newSystemToken, user: updatedUser } = res.data;
        
        // Update local storage
        localStorage.setItem('manar_token', newSystemToken);
        localStorage.setItem('manar_user', JSON.stringify(updatedUser));
        
        // Update student profile cache if it exists
        const profileJson = localStorage.getItem('student_profile');
        if (profileJson) {
          try {
            const profile = JSON.parse(profileJson);
            profile.googleId = updatedUser.googleId;
            localStorage.setItem('student_profile', JSON.stringify(profile));
          } catch (e) {}
        }

        toast.success(
          isAr
            ? 'تم ربط حساب Google بنجاح!'
            : 'Google account linked successfully!'
        );
        navigate('/student/home', { replace: true });
      }
    } catch (err) {
      console.error('[GOOGLE LINK] API Error:', err);
      const errMsg =
        err.response?.data?.error ||
        (isAr
          ? 'فشل ربط الحساب. يرجى المحاولة مرة أخرى.'
          : 'Failed to link Google account. Please try again.');
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('manar_token');
    localStorage.removeItem('manar_user');
    localStorage.removeItem('student_profile');
    navigate('/login', { replace: true });
  };

  return (
    <div
      className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col items-center justify-center p-6 relative overflow-hidden font-urbanist"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Background Ambient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none opacity-20 bg-cyan-500/20 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none opacity-10 bg-purple-500/20 animate-pulse" style={{ animationDelay: '2s' }} />

      {/* Top Utilities */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
        <ThemeSwitcher />
        <button
          onClick={() => i18n.changeLanguage(isAr ? 'en' : 'ar')}
          className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs tracking-widest uppercase hover:bg-white/10 transition-all font-bold text-white"
        >
          {isAr ? 'EN' : 'عربي'}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center"
      >
        {/* Glow Line */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dim)]" />

        {/* Logo */}
        <div className="mb-6 mt-4">
          <Logo size="lg" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black text-white tracking-tight mb-3">
          {isAr ? 'توثيق الحساب الدراسي' : 'Secure Academic Account'}
        </h1>

        {/* Welcome Message */}
        <p className="text-sm text-white/80 leading-relaxed mb-6 font-bold">
          {isAr
            ? 'مرحباً بك في بوابتك الأكاديمية! لضمان أمان حسابك وسرعة دخولك بضغطة زر لاحقاً، يرجى ربط حسابك بـ Google الآن.'
            : 'Welcome to your Academic Portal! To ensure your account security and enable one-tap login in the future, please link your Google account now.'}
        </p>

        {/* Error Alert */}
        {error && (
          <div className="w-full px-4 py-2.5 mb-6 rounded-xl border text-xs font-bold bg-red-500/10 border-red-500/20 text-red-400">
            ⚠️ {error}
          </div>
        )}

        {/* Google Linking Button */}
        <div className="w-full flex justify-center google-login-container mb-6" dir="ltr">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="w-8 h-8 rounded-full border-3 border-[var(--accent)] border-t-transparent animate-spin mb-2" />
              <p className="text-xs text-[var(--text-secondary)] font-bold">
                {isAr ? 'جاري ربط الحساب...' : 'Linking account...'}
              </p>
            </div>
          ) : (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                toast.error(
                  isAr
                    ? 'فشل الاتصال بخدمة Google'
                    : 'Google connection failed'
                );
              }}
              theme="filled_black"
              size="large"
              shape="rectangular"
              width="320"
              text="signin_with"
            />
          )}
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-xl bg-white/2 border border-white/5 text-[11px] text-white/50 leading-relaxed mb-6">
          {isAr
            ? 'ملاحظة: هذا الإجراء إلزامي لمرة واحدة فقط. بعد ربط الحساب، ستتمكن من تسجيل الدخول مباشرة باستخدام حساب Google الخاص بك.'
            : 'Note: This is a one-time mandatory setup. After linking, you can log in directly using your Google account.'}
        </div>

        {/* Logout/Cancel Button */}
        <button
          onClick={handleLogout}
          className="text-xs font-black text-white/50 hover:text-red-400 transition-colors duration-200 uppercase tracking-wider"
        >
          🚪 {isAr ? 'تسجيل الخروج والعودة' : 'Sign Out & Go Back'}
        </button>
      </motion.div>

      {/* Footer */}
      <footer className="mt-8">
        <DevSignature centered={true} />
      </footer>
    </div>
  );
}
