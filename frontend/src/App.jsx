import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import ConfirmationModal from './ConfirmationModal';
import { Toaster, toast } from 'react-hot-toast';
import axios from 'axios';
import { API_URL } from './config';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import ProgressLoader from './components/ProgressLoader';

// Shared layout controls & modal
import Logo from './Logo';
import ThemeSwitcher from './ThemeSwitcher';
import DevSignature from './DevSignature';
import CommandPalette from './CommandPalette';
import ErrorBoundary from './ErrorBoundary';

// Dynamic lazy loaded route page components
// NOTE: LandingPage removed — root "/" route uses PublicLandingWizard (orphan import fix)
const PublicLandingWizard = React.lazy(() => import('./components/PublicLandingWizard'));
const Login = React.lazy(() => import('./Login'));
const TeacherLogin = React.lazy(() => import('./TeacherLogin'));
const Register = React.lazy(() => import('./Register'));
const Verification = React.lazy(() => import('./Verification'));
const Students = React.lazy(() => import('./Students'));
const AdminDashboard = React.lazy(() => import('./AdminDashboard'));
const GroupManagement = React.lazy(() => import('./GroupManagement'));
const SystemLog = React.lazy(() => import('./SystemLog'));
const StudentDashboard = React.lazy(() => import('./StudentDashboard'));
const LecturerDashboard = React.lazy(() => import('./LecturerDashboard'));
const LecturerRequests = React.lazy(() => import('./LecturerRequests'));

const Instructions = React.lazy(() => import('./Instructions'));
const DevPortal = React.lazy(() => import('./DevPortal'));
const AttendanceScanner = React.lazy(() => import('./AttendanceScanner'));
const LecturerAttendanceSession = React.lazy(() => import('./LecturerAttendanceSession'));
const RepresentativeHub = React.lazy(() => import('./RepresentativeHub'));
const GoogleLinkInterceptor = React.lazy(() => import('./components/GoogleLinkInterceptor'));
const LicenseSuspended = React.lazy(() => import('./components/LicenseSuspended'));

// Sleek loading fallback spinner
const PageLoader = () => {
  React.useEffect(() => {
    const userJson = localStorage.getItem('manar_user');
    let user = null;
    try { user = JSON.parse(userJson); } catch {}
    
    let otaColor = null;
    try {
      const cachedSettings = JSON.parse(localStorage.getItem('cached_system_settings') || '{}');
      otaColor = cachedSettings.otaThemeColor;
    } catch {}

    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const color = otaColor || (isSuperAdmin 
      ? localStorage.getItem('superadmin_selectedThemeColor')
      : (user?.themeColor || localStorage.getItem('selectedUniversityThemeColor')));
      
    if (color) {
      document.documentElement.style.setProperty('--accent', color);
      document.documentElement.style.setProperty('--accent-glow', `${color}33`);
      document.documentElement.style.setProperty('--accent-dim', `${color}1a`);
    }
  }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="relative flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent,#2979ff)] border-t-transparent shadow-[0_0_15px_var(--accent-glow,rgba(41,121,255,0.25))]" />
        <span className="absolute text-[8px] font-black uppercase tracking-widest text-[var(--accent,#2979ff)] animate-pulse">
          Load
        </span>
      </div>
    </div>
  );
};

// Global Axios Interceptors for loaders and license checks
let activeRequests = 0;

const dispatchRequestStart = () => {
  activeRequests++;
  if (activeRequests === 1) {
    window.dispatchEvent(new CustomEvent('axios-request-start'));
  }
};

const dispatchRequestEnd = () => {
  activeRequests = Math.max(0, activeRequests - 1);
  if (activeRequests === 0) {
    window.dispatchEvent(new CustomEvent('axios-request-end'));
  }
};

axios.interceptors.request.use(
  (config) => {
    dispatchRequestStart();
    return config;
  },
  (error) => {
    dispatchRequestEnd();
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  (response) => {
    dispatchRequestEnd();
    return response;
  },
  (error) => {
    dispatchRequestEnd();
    if (error.response && error.response.status === 403 && error.response.data?.error === 'LICENSE_REVOKED') {
      localStorage.removeItem('manar_token');
      localStorage.removeItem('manar_user');
      localStorage.removeItem('student_profile');
      window.location.href = '/license-suspended';
    }
    return Promise.reject(error);
  }
);

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ── Dual-State Sync Status Banner ─────────────────────────────────────────
// Shows amber "offline / cached data" OR green "fully synchronized" confirmation.
// The online-synced banner auto-dismisses after 3.5 seconds.
function OfflineBanner() {
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);
  const [showSynced, setShowSynced] = React.useState(false);
  const syncTimerRef = React.useRef(null);

  // Read last-sync timestamp from LocalStorage
  const getLastSyncLabel = () => {
    const ts = parseInt(localStorage.getItem('cached_student_ts') || '0');
    if (!ts) return null;
    const diffMs = Date.now() - ts;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin === 1) return '1 min ago';
    if (diffMin < 60) return `${diffMin} min ago`;
    return null; // too stale to show
  };

  React.useEffect(() => {
    const goOffline = () => {
      setIsOffline(true);
      setShowSynced(false);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
    const goOnline = () => {
      setIsOffline(false);
      setShowSynced(true);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      // Auto-dismiss the green "synced" banner after 3.5 s
      syncTimerRef.current = setTimeout(() => setShowSynced(false), 3500);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    // Listen for manual refresh completions dispatched by StudentDashboard
    const onSynced = () => {
      if (navigator.onLine) {
        setShowSynced(true);
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => setShowSynced(false), 3500);
      }
    };
    window.addEventListener('MANAR_DATA_SYNCED', onSynced);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('MANAR_DATA_SYNCED', onSynced);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  const syncLabel = getLastSyncLabel();

  return (
    <AnimatePresence mode="wait">
      {isOffline && (
        <motion.div
          key="offline"
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -56, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="fixed top-0 left-0 right-0 z-[9990] flex items-center justify-center gap-2 py-2 px-4 text-center text-xs font-black tracking-wide"
          style={{
            background: 'linear-gradient(90deg, #d97706, #f59e0b)',
            color: '#000',
            fontFamily: "'Urbanist', system-ui, sans-serif",
            boxShadow: '0 2px 20px rgba(245,158,11,0.45)',
          }}
        >
          <span className="animate-pulse">📡</span>
          <span>
            أنت الآن في وضع عدم الاتصال — الجداول المخزنة متاحة
            <span className="mx-1 opacity-50">|</span>
            Offline Mode — Viewing cached schedule
          </span>
        </motion.div>
      )}

      {!isOffline && showSynced && (
        <motion.div
          key="synced"
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -56, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="fixed top-0 left-0 right-0 z-[9990] flex items-center justify-center gap-2 py-2 px-4 text-center text-xs font-black tracking-wide"
          style={{
            background: 'linear-gradient(90deg, #059669, #10b981)',
            color: '#fff',
            fontFamily: "'Urbanist', system-ui, sans-serif",
            boxShadow: '0 2px 20px rgba(16,185,129,0.45)',
          }}
        >
          <span>✅</span>
          <span>
            النظام متزامن بالكامل
            {syncLabel ? ` · آخر تزامن ${syncLabel}` : ''}
            <span className="mx-1 opacity-50">|</span>
            System fully synchronized
            {syncLabel ? ` · Last sync ${syncLabel}` : ''}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AppLayout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [tenants, setTenants] = useState([]);

  const isAr = i18n.language === 'ar';
  const token = localStorage.getItem('manar_token');

  // Admin secure gateway passcode lock
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(sessionStorage.getItem('manar_admin_unlocked') === 'true');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminVerifying, setAdminVerifying] = useState(false);
  const [adminPasscodeError, setAdminPasscodeError] = useState('');

  const handleVerifyAdminPasscode = async (e) => {
    e.preventDefault();
    setAdminVerifying(true);
    setAdminPasscodeError('');
    try {
      const res = await axios.post(`${API_URL}/api/admin/dev/verify-key`, 
        { passcode: adminPasscode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        sessionStorage.setItem('manar_admin_unlocked', 'true');
        setIsAdminUnlocked(true);
        toast.success(isAr ? 'تم فتح لوحة التحكم بنجاح' : 'Admin Panel unlocked successfully');
      }
    } catch (err) {
      setAdminPasscodeError(err.response?.data?.error || (isAr ? 'رمز المرور غير صحيح' : 'Incorrect passcode'));
      toast.error(isAr ? 'فشل التحقق من رمز المرور' : 'Passcode verification failed');
    } finally {
      setAdminVerifying(false);
    }
  };

  const handleAdminCancel = () => {
    localStorage.removeItem('manar_token');
    localStorage.removeItem('manar_user');
    localStorage.removeItem('student_profile');
    navigate('/login');
  };

  const handleLogoClick = () => {
    const token = localStorage.getItem('manar_token');
    const userJson = localStorage.getItem('manar_user');
    let user = null;
    if (userJson) {
      try { user = JSON.parse(userJson); } catch {}
    }
    if (!token || !user) {
      navigate('/');
      return;
    }
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'COLLEGE_ADMIN' || user.role === 'UNI_ADMIN') {
      navigate('/admin/overview');
    } else if (user.role === 'LECTURER') {
      navigate('/lecturer/home');
    } else if (user.role === 'STUDENT') {
      navigate('/student/home');
    } else {
      navigate('/');
    }
  };

  // ── Persistent Theme Color application ───────────────────────────────────
  useEffect(() => {
    const applyTheme = () => {
      const userJson = localStorage.getItem('manar_user');
      let user = null;
      try { user = JSON.parse(userJson); } catch {}
      
      let otaColor = null;
      try {
        const cachedSettings = JSON.parse(localStorage.getItem('cached_system_settings') || '{}');
        otaColor = cachedSettings.otaThemeColor;
      } catch {}

      const isSuperAdmin = user?.role === 'SUPER_ADMIN';
      const color = otaColor || (isSuperAdmin 
        ? localStorage.getItem('superadmin_selectedThemeColor')
        : (user?.themeColor || localStorage.getItem('selectedUniversityThemeColor')));
        
      if (color) {
        document.documentElement.style.setProperty('--accent', color);
        document.documentElement.style.setProperty('--accent-glow', `${color}33`);
        document.documentElement.style.setProperty('--accent-dim', `${color}1a`);
      }
    };
    applyTheme();
    window.addEventListener('MANAR_COLLEGE_SWITCH', applyTheme);
    return () => window.removeEventListener('MANAR_COLLEGE_SWITCH', applyTheme);
  }, []);

  // ── PWA Soft Update Listener ─────────────────────────────────────────────
  useEffect(() => {
    const handleUpdate = (e) => {
      const { updateHandler } = e.detail;
      const isAr = i18n.language === 'ar';
      
      toast((t) => (
        <div className="flex flex-col gap-3 p-2 min-w-[280px]" dir={isAr ? 'rtl' : 'ltr'}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🚀</span>
            <div className="flex flex-col text-start">
              <span className="text-xs font-black text-white">
                {isAr ? 'تم إطلاق تحديث جديد للنظام!' : 'New Update Available!'}
              </span>
              <span className="text-[10px] text-white/50">
                {isAr ? 'يرجى التحديث للحصول على آخر الميزات والتحسينات.' : 'Please update to get the latest features.'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                updateHandler();
              }}
              className="flex-1 py-1.5 px-3 rounded-lg bg-[var(--accent)] text-[var(--bg-primary)] text-[10px] font-black hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              {isAr ? 'تحديث الآن' : 'Update Now'}
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-[10px] font-bold hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            >
              {isAr ? 'لاحقاً' : 'Later'}
            </button>
          </div>
        </div>
      ), {
        position: 'bottom-center',
        duration: Infinity,
        style: {
          background: 'rgba(15, 15, 15, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        }
      });
    };

    window.addEventListener('MANAR_SW_UPDATE_AVAILABLE', handleUpdate);
    return () => {
      window.removeEventListener('MANAR_SW_UPDATE_AVAILABLE', handleUpdate);
    };
  }, [i18n.language]);

  // ── Fetch Tenants for Super Admin Dropdown ───────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('manar_token');
    const userJson = localStorage.getItem('manar_user');
    if (!token || !userJson) return;
    
    let userObj = null;
    try { userObj = JSON.parse(userJson); } catch {}
    if (userObj?.role === 'SUPER_ADMIN') {
      axios.get(`${API_URL}/api/tenants`)
        .then(res => {
          if (res.data?.success) {
            setTenants(res.data.data);
            // Auto-select first college if none is selected yet
            const savedCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
            if (!savedCollegeId && res.data.data.length > 0) {
              const firstUni = res.data.data[0];
              if (firstUni.colleges && firstUni.colleges.length > 0) {
                const firstCol = firstUni.colleges[0];
                localStorage.setItem('superadmin_selectedCollegeId', firstCol.id);
                localStorage.setItem('superadmin_selectedCollegeName', firstCol.name);
                localStorage.setItem('superadmin_selectedUniversityName', firstUni.name);
                localStorage.setItem('superadmin_selectedUniversityLogo', firstUni.logoUrl || '');
                localStorage.setItem('superadmin_selectedThemeColor', firstUni.themeColor || '');
                window.dispatchEvent(new CustomEvent('MANAR_COLLEGE_SWITCH'));
              }
            }
          }
        })
        .catch(err => console.error('[App] Failed to load tenants for switcher:', err));
    }
  }, [path]);

  // ── Session Restoration: Auto-redirect on cold load ──────────────────────
  useEffect(() => {
    const token = localStorage.getItem('manar_token');
    const userJson = localStorage.getItem('manar_user');
    if (!token || !userJson) return;

    let user = null;
    try { user = JSON.parse(userJson); } catch { return; }
    if (!user) return;

    // Only auto-redirect from public / root paths
    const isPublicPath = ['/', '/login', '/register', '/verify'].includes(path);
    if (!isPublicPath) return; // Already on a protected route, let route guards handle it

    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'COLLEGE_ADMIN' || user.role === 'UNI_ADMIN') {
      navigate('/admin/overview', { replace: true });
    } else if (user.role === 'LECTURER') {
      navigate('/lecturer/home', { replace: true });
    } else if (user.role === 'STUDENT') {
      navigate('/student/home', { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Navigation Lock: Block back button to public pages when logged in ─────
  useEffect(() => {
    const token = localStorage.getItem('manar_token');
    const userJson = localStorage.getItem('manar_user');
    if (!token || !userJson) return;
    let user = null;
    try { user = JSON.parse(userJson); } catch { return; }
    if (!user) return;

    const publicPaths = ['/', '/login', '/register', '/verify'];
    const isOnPublicPath = publicPaths.includes(path);
    if (!isOnPublicPath) return;

    // User is logged in but on a public path — push them forward
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'COLLEGE_ADMIN' || user.role === 'UNI_ADMIN') {
      navigate('/admin/overview', { replace: true });
    } else if (user.role === 'LECTURER') {
      navigate('/lecturer/home', { replace: true });
    } else if (user.role === 'STUDENT') {
      navigate('/student/home', { replace: true });
    }
  }, [path]); // Runs every time path changes

  // ── Web Push Notification Subscription ───────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('manar_token');
    const userJson = localStorage.getItem('manar_user');
    if (!token || !userJson) return;

    // Ask for permission and register push subscription
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(async (registration) => {
        try {
          // Get public VAPID key
          const keyRes = await axios.get(`${API_URL}/api/notifications/vapid-key`);
          if (keyRes.data?.success && keyRes.data.publicKey) {
            const publicVapidKey = keyRes.data.publicKey;

            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
              // Ask permission first
              const permission = await Notification.requestPermission();
              if (permission === 'granted') {
                subscription = await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                });
              }
            }

            if (subscription) {
              await axios.post(`${API_URL}/api/notifications/subscribe`, { subscription }, {
                headers: { Authorization: `Bearer ${token}` }
              });
              console.log('[PUSH] Successfully subscribed and synced with server.');
            }
          }
        } catch (err) {
          console.warn('[PUSH] Subscription registration failed:', err.message);
        }
      });
    }
  }, [path]);

  // ── Server-Sent Events (SSE) Live Update Listener ────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('manar_token');
    if (!token) return;

    console.log('[SSE] Connecting to live updates stream...');
    const url = token ? `${API_URL}/api/schedules/live?token=${encodeURIComponent(token)}` : `${API_URL}/api/schedules/live`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log('[SSE] Broadcast event received:', payload);

        if (payload.type === 'SCHEDULE_UPDATE') {
          toast(i18n.language === 'ar' ? '📅 تم تحديث جدول المحاضرات للتو!' : '📅 Lecture schedule has been updated!', {
            icon: '🔔',
            duration: 5000,
            style: { border: '1px solid var(--accent)' }
          });
          // Dispatch custom window event to trigger dashboard/profile re-fetches
          window.dispatchEvent(new CustomEvent('MANAR_SCHEDULE_UPDATE'));
        } else if (payload.type === 'BROADCAST_MESSAGE') {
          const userJson = localStorage.getItem('manar_user');
          let currentUser = null;
          try { currentUser = JSON.parse(userJson); } catch {}

          if (payload.data.groupId === null || (currentUser && currentUser.groupId === payload.data.groupId)) {
            toast(payload.data.message, {
              icon: '📢',
              duration: 8000,
              style: { border: '1px solid #60c4ff' }
            });
            window.dispatchEvent(new CustomEvent('MANAR_BROADCAST_RECEIVE'));

            if (payload.data.broadcastId && currentUser?.role === 'STUDENT') {
              axios.post(`${API_URL}/api/notifications/mark-delivered`, {
                broadcastId: payload.data.broadcastId
              }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
              }).catch(e => console.warn('[App] Failed to mark broadcast delivered:', e.message));
            }
          }
        } else if (payload.type === 'NEW_NOTIFICATION') {
          const userJson = localStorage.getItem('manar_user');
          let currentUser = null;
          try { currentUser = JSON.parse(userJson); } catch {}

          if (currentUser && currentUser.id === payload.data.studentId) {
            toast(payload.data.message, {
              icon: '📢',
              duration: 8000,
              style: { border: '1px solid #a855f7' }
            });
            window.dispatchEvent(new CustomEvent('MANAR_BROADCAST_RECEIVE'));

            if (payload.data.broadcastId) {
              axios.post(`${API_URL}/api/notifications/mark-delivered`, {
                broadcastId: payload.data.broadcastId
              }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
              }).catch(e => console.warn('[App] Failed to mark admin notification delivered:', e.message));
            }
          }
        } else if (payload.type === 'ATTENDANCE_RECORDED') {
          const userJson = localStorage.getItem('manar_user');
          let currentUser = null;
          try { currentUser = JSON.parse(userJson); } catch {}

          if (currentUser && currentUser.id === payload.data.studentId) {
            toast(payload.data.message, {
              icon: '📝',
              duration: 8000,
              style: { border: '1px solid #10b981' }
            });
            window.dispatchEvent(new CustomEvent('MANAR_ATTENDANCE_MARKED'));
          }
        } else if (payload.type === 'ATTENDANCE_MARKED') {
          window.dispatchEvent(new CustomEvent('MANAR_ATTENDANCE_MARKED', { detail: payload.data }));
        } else if (payload.type === 'DEV_ACTIVITY_LOG') {
          toast(payload.data.message, {
            icon: '⚡',
            duration: 5000,
            style: { border: '1px solid #a855f7' }
          });
          window.dispatchEvent(new CustomEvent('MANAR_DEV_ACTIVITY_LOG', { detail: payload.data }));
        } else if (payload.type === 'SYSTEM_SETTINGS_UPDATE') {
          if (payload.data && payload.data.settings) {
            localStorage.setItem('cached_system_settings', JSON.stringify(payload.data.settings));
            window.dispatchEvent(new CustomEvent('MANAR_SYSTEM_SETTINGS_UPDATE', { detail: payload.data.settings }));
            
            // Live OTA theme injection
            const userJson = localStorage.getItem('manar_user');
            let user = null;
            try { user = JSON.parse(userJson); } catch {}
            const isSuperAdmin = user?.role === 'SUPER_ADMIN';
            const otaColor = payload.data.settings.otaThemeColor;
            
            if (otaColor) {
              document.documentElement.style.setProperty('--accent', otaColor);
              document.documentElement.style.setProperty('--accent-glow', `${otaColor}33`);
              document.documentElement.style.setProperty('--accent-dim', `${otaColor}1a`);
            } else {
              const origColor = isSuperAdmin 
                ? localStorage.getItem('superadmin_selectedThemeColor')
                : (user?.themeColor || localStorage.getItem('selectedUniversityThemeColor'));
              if (origColor) {
                document.documentElement.style.setProperty('--accent', origColor);
                document.documentElement.style.setProperty('--accent-glow', `${origColor}33`);
                document.documentElement.style.setProperty('--accent-dim', `${origColor}1a`);
              }
            }
          }
        } else if (payload.type === 'EXCHANGE_POST_CREATED') {
          window.dispatchEvent(new CustomEvent('MANAR_EXCHANGE_POST_CREATED', { detail: payload.data }));
        } else if (payload.type === 'EXCHANGE_POST_DELETED') {
          window.dispatchEvent(new CustomEvent('MANAR_EXCHANGE_POST_DELETED', { detail: payload.data }));
        } else if (payload.type === 'EXCHANGE_COMMENT_CREATED') {
          window.dispatchEvent(new CustomEvent('MANAR_EXCHANGE_COMMENT_CREATED', { detail: payload.data }));
        } else if (payload.type === 'EXCHANGE_COMMENT_DELETED') {
          window.dispatchEvent(new CustomEvent('MANAR_EXCHANGE_COMMENT_DELETED', { detail: payload.data }));
        }
      } catch (err) {
        console.error('[SSE] Error processing incoming event:', err);
      }
    };

    eventSource.onerror = () => {
      console.warn('[SSE] EventSource stream closed. Auto-reconnecting...');
    };

    return () => {
      console.log('[SSE] Closing live updates stream...');
      eventSource.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  // ───────────────────────────────────────────────────────────────────────────

  const isAdminPath = path.startsWith('/admin') || path.startsWith('/super-admin');
  const isStudentPath = path.startsWith('/student');
  const isLecturerPath = path.startsWith('/lecturer');

  const userJson = localStorage.getItem('manar_user');
  let user = null;
  if (userJson) {
    try {
      user = JSON.parse(userJson);
    } catch (e) {
      console.error(e);
    }
  }
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const universityLogoUrlRaw = isSuperAdmin
    ? (localStorage.getItem('superadmin_selectedUniversityLogo') || '')
    : (user?.universityLogo || localStorage.getItem('selectedUniversityLogo'));

  const selectedSlug = localStorage.getItem('selectedUniversitySlug');
  const activeName = user?.universityName || localStorage.getItem('selectedUniversityName') || '';
  const activeSlug = selectedSlug || (isSuperAdmin ? localStorage.getItem('superadmin_selectedUniversitySlug') : '');

  const universityLogoUrl = activeSlug === 'hajjah-university' || activeName.includes('حجة') || activeName.includes('Hajjah') ? '/hajjah-logo-new.png' :
                            activeSlug === 'almanar-college' || activeName.includes('المنار') || activeName.includes('Manar') ? '/almanar-logo.png' : universityLogoUrlRaw;

  const getBrandedTitle = (isAr) => {
    const uniName = isSuperAdmin
      ? localStorage.getItem('superadmin_selectedUniversityName')
      : (user?.universityName || localStorage.getItem('selectedUniversityName'));
    const colName = isSuperAdmin
      ? localStorage.getItem('superadmin_selectedCollegeName')
      : (user?.collegeName || localStorage.getItem('selectedCollegeName'));
    
    if (uniName && colName) {
      if (uniName === colName) return uniName;
      return `${uniName} - ${colName}`;
    }
    return colName || uniName || (isAr ? 'بوابة الطالب الجامعي' : 'University Student Portal');
  };

  const renderLogo = (size) => {
    const logoEl = universityLogoUrl ? (
      <img 
        src={universityLogoUrl} 
        alt="Logo" 
        className={`object-contain shrink-0 rounded-md drop-shadow-[0_0_8px_rgba(255,255,255,0.15)] ${
          size === 'sm' ? 'w-7 h-7' : 'w-10 h-10'
        }`} 
      />
    ) : (
      <Logo size={size} />
    );

    return (
      <div 
        onClick={handleLogoClick} 
        className="cursor-pointer hover:opacity-80 active:scale-95 transition-all flex items-center justify-center shrink-0"
        title={isAr ? 'الذهاب إلى الصفحة الرئيسية' : 'Go to Home'}
      >
        {logoEl}
      </div>
    );
  };

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleLogoutClick = (e) => {
    e?.preventDefault();
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    const token = localStorage.getItem('manar_token');
    if (token) {
      axios.post(`${API_URL}/api/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(err => console.warn('[Logout API] Error logging out:', err.message));
    }
    localStorage.removeItem('manar_token');
    localStorage.removeItem('manar_user');
    localStorage.removeItem('student_profile');
    setIsLogoutModalOpen(false);
    navigate('/login');
  };

  const renderImpersonationBanner = () => {
    const isImpersonating = !!localStorage.getItem('manar_super_admin_token');
    if (!isImpersonating) return null;

    const isAr = i18n.language === 'ar';
    return (
      <div 
        className="fixed top-0 left-0 right-0 z-[9999] h-10 bg-gradient-to-r from-amber-600 to-orange-700 text-white flex items-center justify-between px-6 text-xs font-bold font-sans shadow-2xl border-b border-orange-500/20"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center gap-2">
          <span className="animate-pulse">🔴</span>
          <span>
            {isAr 
              ? `أنت في وضع المحاكاة والمعاينة: ${user?.name} (${user?.role})` 
              : `Active User Impersonation Preview: ${user?.name} (${user?.role})`}
          </span>
        </div>
        <button
          onClick={() => {
            const superToken = localStorage.getItem('manar_super_admin_token');
            const superUser = localStorage.getItem('manar_super_admin_user');
            
            localStorage.removeItem('manar_super_admin_token');
            localStorage.removeItem('manar_super_admin_user');
            
            if (superToken && superUser) {
              localStorage.setItem('manar_token', superToken);
              localStorage.setItem('manar_user', superUser);
            }
            
            localStorage.removeItem('student_profile');
            window.location.href = '/admin/dev-portal';
          }}
          className="bg-black/40 hover:bg-black/60 px-3 py-1 rounded-md text-[10px] uppercase font-black tracking-wider transition-all border border-white/10 cursor-pointer"
        >
          {isAr ? 'إنهاء المعاينة والعودة' : 'Exit Preview & Return'}
        </button>
      </div>
    );
  };

  if (isAdminPath) {
    if (!token || !user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'COLLEGE_ADMIN' && user.role !== 'UNI_ADMIN')) {
      return <Navigate to="/login" replace />;
    }

    if (!isAdminUnlocked) {
      return (
        <div 
          dir={isAr ? 'rtl' : 'ltr'} 
          className="min-h-screen w-full bg-[var(--bg-primary)] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans"
        >
          {/* Glow ambient background orbs */}
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none opacity-25 bg-cyan-500/20 animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none opacity-15 bg-purple-500/20 animate-pulse" style={{ animationDelay: '2.5s' }} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', duration: 0.6 }}
            className="w-full max-w-md bg-black/45 border border-white/10 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center"
          >
            {/* Top glowing bar */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 via-[var(--accent)] to-purple-600 animate-pulse" />
            
            <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-6 shadow-inner animate-bounce" style={{ animationDuration: '3s' }}>
              🔒
            </div>

            <h2 className="text-xl font-black text-white tracking-wider mb-2 uppercase">
              {isAr ? 'بوابة العبور الآمنة للمسؤول' : 'Admin Secure Gateway'}
            </h2>
            <p className="text-xs text-white/50 leading-relaxed mb-6">
              {isAr 
                ? 'مطلوب إدخال رمز التحقق الأمني لفتح لوحة التحكم والتشخيص.' 
                : 'Passcode authorization is required to access the admin command center.'}
            </p>

            <form onSubmit={handleVerifyAdminPasscode} className="space-y-4">
              <div className="space-y-1 text-right" dir={isAr ? 'rtl' : 'ltr'}>
                <input 
                  type="password"
                  autoComplete="one-time-code"
                  required
                  value={adminPasscode}
                  onChange={e => {
                    setAdminPasscode(e.target.value);
                    setAdminPasscodeError('');
                  }}
                  placeholder="••••••••••••"
                  className="w-full text-center px-5 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all duration-200 text-lg tracking-[0.25em] font-mono"
                  autoFocus
                />
              </div>

              {adminPasscodeError && (
                <motion.p 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs text-red-400 font-bold flex items-center justify-center gap-1.5"
                >
                  <span>⚠️</span> {adminPasscodeError}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={adminVerifying}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all text-xs uppercase tracking-widest disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {adminVerifying ? (
                  <span className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isAr ? 'تحقق وعبور' : 'Authorize & Enter'}</span>
                    <span>⚡</span>
                  </>
                )}
              </button>
            </form>

            {/* Cancel & return */}
            <div className="mt-6 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={handleAdminCancel}
                className="text-xs font-bold text-white/40 hover:text-white transition-colors duration-200 cursor-pointer"
              >
                {isAr ? '← إلغاء وتسجيل الخروج' : '← Cancel & Logout'}
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    const isAr = i18n.language === 'ar';

    /* Nav link helper */
    const navLink = (to, icon, label, activeColor = 'var(--accent)') => {
      const isActive = path === to;
      return (
        <Link
          key={to}
          to={to}
          onClick={() => setIsSidebarOpen(false)}
          style={isActive ? { color: activeColor, background: `var(--accent-dim)`, borderLeft: isAr ? 'none' : `2px solid ${activeColor}`, borderRight: isAr ? `2px solid ${activeColor}` : 'none' } : {}}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all duration-200 ${
            isActive ? '' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/3'
          }`}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </Link>
      );
    };

    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col md:flex-row" style={{ paddingTop: localStorage.getItem('manar_super_admin_token') ? '104px' : '64px' }}>
        {renderImpersonationBanner()}
        {/* ── Top header bar ───────────────────────────────────── */}
        <header
          className="fixed left-0 right-0 z-40 flex items-center justify-between px-6 glass-header"
          style={{
            top: localStorage.getItem('manar_super_admin_token') ? '40px' : '0px',
            height: '64px',
          }}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-none">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`h-12 w-12 flex md:hidden items-center justify-center ${isAr ? '-mr-2 ml-1' : '-ml-2 mr-1'} text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-xl`}
              aria-label="Toggle Menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={isSidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
            {renderLogo('sm')}
            <span className="text-xs md:text-sm font-black tracking-wider uppercase truncate" style={{ color: 'var(--accent)' }}>
              {getBrandedTitle(isAr)}
            </span>
            {user?.role === 'SUPER_ADMIN' && tenants.length > 0 && (
              <div className="ms-3 relative">
                <select
                  value={localStorage.getItem('superadmin_selectedCollegeId') || ''}
                  onChange={(e) => {
                    const colId = parseInt(e.target.value);
                    let selectedUni = null;
                    let selectedCol = null;
                    for (const uni of tenants) {
                      const col = uni.colleges?.find(c => c.id === colId);
                      if (col) {
                        selectedUni = uni;
                        selectedCol = col;
                        break;
                      }
                    }
                    if (selectedCol && selectedUni) {
                      localStorage.setItem('superadmin_selectedCollegeId', selectedCol.id);
                      localStorage.setItem('superadmin_selectedCollegeName', selectedCol.name);
                      localStorage.setItem('superadmin_selectedUniversityName', selectedUni.name);
                      localStorage.setItem('superadmin_selectedUniversityLogo', selectedUni.logoUrl || '');
                      localStorage.setItem('superadmin_selectedThemeColor', selectedUni.themeColor || '');
                      
                      // Dispatch switch event
                      window.dispatchEvent(new CustomEvent('MANAR_COLLEGE_SWITCH'));
                      
                      toast.success(isAr 
                        ? `تم الانتقال إلى: ${selectedCol.name}` 
                        : `Switched to: ${selectedCol.name}`
                      );
                    }
                  }}
                  className="bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase text-white/95 focus:outline-none focus:border-[var(--accent)] px-3 py-1.5 cursor-pointer"
                  style={{ maxWidth: '160px' }}
                >
                  {tenants.map(uni => (
                    <optgroup key={uni.id} label={uni.name} className="bg-[#0c0c0c] text-white/60">
                      {uni.colleges?.map(col => (
                        <option key={col.id} value={col.id} className="bg-[#0c0c0c] text-white">
                          {col.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <button
              onClick={() => i18n.changeLanguage(isAr ? 'en' : 'ar')}
              className="btn-ghost px-3 py-1.5 text-xs tracking-widest uppercase"
            >
              {isAr ? 'EN' : 'عربي'}
            </button>
          </div>
        </header>

        {/* ── Mobile Backdrop Overlay ───────────────────────────── */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* ── Admin sidebar ────────────────────────────────────── */}
        <aside
          className={`fixed inset-y-0 ${isAr ? 'right-0' : 'left-0'} z-50 w-64 bg-[var(--bg-elevated)] transition-transform duration-300 ease-in-out transform ${
            isSidebarOpen ? 'translate-x-0' : (isAr ? 'translate-x-full' : '-translate-x-full')
          } md:translate-x-0 md:static md:w-64 md:flex flex-col justify-between shrink-0`}
          style={{
            borderRight: isAr ? 'none' : '1px solid var(--border-color)',
            borderLeft: isAr ? '1px solid var(--border-color)' : 'none'
          }}
        >
          <div className="p-5 pt-7 space-y-7">
            {/* Wordmark */}
            <div>
              <p className="text-[10px] font-black tracking-[0.28em] uppercase" style={{ color: 'var(--text-muted)' }}>
                Admin Panel
              </p>
            </div>

            {/* Nav links */}
            <nav className="space-y-1">
              {navLink('/admin/overview',  '📊', isAr ? 'نظرة عامة' : 'Overview')}
              {navLink('/admin/approvals', '🎓', isAr ? 'توثيق الطلاب' : 'Student Approvals')}
              {navLink('/admin/schedule',  '📅', isAr ? 'مدير الجداول' : 'Schedule Manager')}
              {navLink('/admin/exams',     '📝', isAr ? 'جدول الامتحانات' : 'Exam Schedule')}
              {navLink('/admin/broadcast', '📢', isAr ? 'البث العام' : 'Broadcast Center')}
              {navLink('/admin/bulk-import','📥', isAr ? 'رفع Excel جماعي' : 'Bulk Excel Import')}
              {navLink('/admin/lecturers', '👨‍🏫', isAr ? 'أعضاء هيئة التدريس' : 'Lecturers')}
              {navLink('/admin/groups',    '👥', isAr ? 'إدارة الشعب' : 'Group Management')}
              {navLink('/admin/students',  '🎓', isAr ? 'سجل الطلاب' : 'Students Database')}
              {navLink('/admin/logs',      '📜', isAr ? 'سجلات النظام' : 'System Logs')}
              {user?.role === 'SUPER_ADMIN' && (user.email === 'developer@mghal.com' || user.email === 'm.gh.alosimi@gmail.com') && (
                <>
                  {navLink('/admin/dev-portal', '⌨️', isAr ? 'بوابة المطورين' : 'Dev Portal', '#60c4ff')}
                  <button
                    onClick={async () => {
                      try {
                        const tk = localStorage.getItem('manar_token');
                        const sRes = await axios.get(`${API_URL}/api/students`, { headers: { Authorization: `Bearer ${tk}` } });
                        if (sRes.data?.success && sRes.data.data.length > 0) {
                          const s = sRes.data.data[0];
                          const r = await axios.post(`${API_URL}/api/auth/impersonate`, { studentId: s.id }, { headers: { Authorization: `Bearer ${tk}` } });
                          if (r.data?.success) {
                            localStorage.setItem('manar_token', r.data.token);
                            localStorage.setItem('manar_user', JSON.stringify(r.data.user));
                            localStorage.setItem('student_profile', JSON.stringify({ name: s.name, email: s.email, department: s.major?.department?.name || '', level: s.level?.name || '', groupId: s.groupId }));
                            toast.success(isAr ? `معاينة: ${s.name}` : `Preview as ${s.name}`);
                            setIsSidebarOpen(false);
                            navigate('/student/home');
                          }
                        } else {
                          toast.error(isAr ? 'لا يوجد طلاب' : 'No students found');
                        }
                      } catch { toast.error(isAr ? 'فشل المعاينة' : 'Preview failed'); }
                    }}
                    className="w-full mt-1 flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
                  >
                    <span>🔑 {isAr ? 'دخول كطالب' : 'Student Preview'}</span>
                    <span style={{ color: 'var(--accent)' }}>{isAr ? '←' : '→'}</span>
                  </button>
                </>
              )}
            </nav>
          </div>

          {/* Sidebar footer */}
          <div className="p-5 space-y-4" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={handleLogoutClick}
              className="btn-ghost w-full py-2.5 text-xs font-black tracking-wide"
            >
              🚪 {isAr ? 'تسجيل الخروج' : 'Sign Out'}
            </button>
            <DevSignature centered={true} />
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
          <Routes>
            <Route path="/admin/overview" element={<AdminDashboard tab="overview" />} />
            <Route path="/admin/approvals" element={<AdminDashboard tab="approvals" />} />
            <Route path="/admin/schedule" element={<AdminDashboard tab="schedule" />} />
            <Route path="/admin/exams" element={<AdminDashboard tab="exams" />} />
            <Route path="/admin/broadcast" element={<AdminDashboard tab="broadcast" />} />
            <Route path="/admin/bulk-import" element={<AdminDashboard tab="bulkImport" />} />
            <Route path="/admin/lecturers" element={<AdminDashboard tab="lecturers" />} />
            <Route path="/admin/groups" element={<GroupManagement />} />
            <Route path="/admin/students"   element={<Students />} />
            <Route path="/admin/logs"       element={<SystemLog />} />
            <Route path="/admin/god-mode"   element={<Navigate to="/admin/dev-portal" replace />} />
            <Route path="/super-admin/dashboard" element={<Navigate to="/admin/dev-portal" replace />} />
            <Route path="/admin/dev-portal" element={user?.role === 'SUPER_ADMIN' && (user.email === 'developer@mghal.com' || user.email === 'm.gh.alosimi@gmail.com') ? <DevPortal /> : <Navigate to="/admin/overview" replace />} />
            <Route path="/admin/instructions" element={<Instructions />} />
            <Route path="*" element={<Navigate to="/admin/overview" replace />} />
          </Routes>
        </div>

        <ConfirmationModal
          isOpen={isLogoutModalOpen}
          title={isAr ? 'تأكيد تسجيل الخروج' : 'Confirm Sign Out'}
          message={isAr ? 'هل أنت متأكد من الخروج؟' : 'Are you sure you want to sign out?'}
          onConfirm={confirmLogout}
          onCancel={() => setIsLogoutModalOpen(false)}
          confirmText={isAr ? 'خروج' : 'Sign Out'}
          cancelText={isAr ? 'إلغاء' : 'Cancel'}
        />
      </div>
    );
  }

  if (isLecturerPath) {
    if (!token || !user || user.role !== 'LECTURER') {
      return <Navigate to="/login" replace />;
    }

    const isAr = i18n.language === 'ar';

    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col items-center relative overflow-hidden">
        {renderImpersonationBanner()}
        {/* Ambient background orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none opacity-20 bg-cyan-500/20 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none opacity-10 bg-purple-500/20 animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="w-full max-w-md min-h-screen flex flex-col relative pb-24 z-10" style={{ paddingTop: localStorage.getItem('manar_super_admin_token') ? '104px' : '64px', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
          
          {/* Lecturer top header */}
          <header
            className="fixed z-40 flex items-center justify-between px-5 glass-header"
            style={{
              top: localStorage.getItem('manar_super_admin_token') ? '40px' : '0px',
              width: 'inherit', maxWidth: '448px',
              height: '64px',
            }}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {renderLogo('sm')}
              <span className="text-xs font-black tracking-wider uppercase truncate" style={{ color: 'var(--accent)' }}>
                {getBrandedTitle(isAr)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              <button
                onClick={() => i18n.changeLanguage(isAr ? 'en' : 'ar')}
                className="btn-ghost px-3 py-1 text-[10px] tracking-widest uppercase"
              >
                {isAr ? 'EN' : 'عربي'}
              </button>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            <Routes>
              <Route path="/lecturer/home" element={<LecturerDashboard />} />
              <Route path="/lecturer/requests" element={<LecturerRequests />} />
              <Route path="/lecturer/attendance/:scheduleId" element={<LecturerAttendanceSession />} />
              <Route path="*" element={<Navigate to="/lecturer/home" replace />} />
            </Routes>
          </div>

          {/* Premium floating glass nav dock for Lecturer */}
          <nav
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center"
            style={{
              width: 'calc(100% - 2rem)', maxWidth: '400px',
              background: 'var(--bg-card)',
              backdropFilter: 'blur(24px)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              padding: '10px 16px',
              gap: '4px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02) inset',
            }}
          >
            {[
              { to: '/lecturer/home',     icon: '🏠', label: isAr ? 'الرئيسية' : 'Home' },
              { to: '/lecturer/requests', icon: '📝', label: isAr ? 'الطلبات' : 'Requests' }
            ].map(({ to, icon, label }) => {
              const active = path === to;
              return (
                <Link key={to} to={to}
                  className="flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all duration-200 relative"
                  style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }}
                >
                  <span className="text-[17px] leading-none mb-0.5">{icon}</span>
                  <span className="text-[9px] font-black tracking-wide">{label}</span>
                  {active && <span className="absolute bottom-0.5 h-0.5 w-4 rounded-full" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />}
                </Link>
              );
            })}
            <button
              onClick={handleLogoutClick}
              className="flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all duration-200"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <span className="text-[17px] leading-none mb-0.5">🚪</span>
              <span className="text-[9px] font-black tracking-wide">{isAr ? 'خروج' : 'Logout'}</span>
            </button>
          </nav>
        </div>

        <ConfirmationModal
          isOpen={isLogoutModalOpen}
          title={isAr ? 'تأكيد الخروج' : 'Confirm Sign Out'}
          message={isAr ? 'هل أنت متأكد من الخروج؟' : 'Are you sure you want to sign out?'}
          onConfirm={confirmLogout}
          onCancel={() => setIsLogoutModalOpen(false)}
          confirmText={isAr ? 'خروج' : 'Sign Out'}
          cancelText={isAr ? 'إلغاء' : 'Cancel'}
        />
      </div>
    );
  }

  if (isStudentPath) {
    if (!token || !user || user.role !== 'STUDENT') {
      return <Navigate to="/login" replace />;
    }

    // Phase 2: Enforce Google Link Interceptor
    if (!user.googleId) {
      return <Navigate to="/link-google" replace />;
    }

    // PHASE 2 FIX: isAr MUST be declared here — it is referenced in the JSX return below
    // (e.g. dir={isAr ? 'rtl' : 'ltr'}). Without this declaration the component throws a
    // ReferenceError in production strict mode, producing a blank white screen for all students.
    const isAr = i18n.language === 'ar';

    // Full-screen layout for /student/home (StudentDashboard has its own internal nav)
    const isStudentHome = path === '/student/home';

    const studentRoutes = (
      <Routes>
        <Route path="/student/home"          element={<StudentDashboard />} />
        <Route path="/student/schedule"      element={<Navigate to="/student/home" replace />} />
        <Route path="/student/notifications" element={<Navigate to="/student/home" replace />} />
        <Route path="/student/settings"      element={<Navigate to="/student/home" replace />} />
        <Route path="/student/scan"          element={<AttendanceScanner />} />
        <Route path="/student/representative" element={<RepresentativeHub />} />
        <Route path="*" element={<Navigate to="/student/home" replace />} />
      </Routes>
    );

    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col items-center relative overflow-hidden">
        {renderImpersonationBanner()}
        {/* Ambient background orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none opacity-20 bg-cyan-500/20 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none opacity-10 bg-purple-500/20 animate-pulse" style={{ animationDelay: '2s' }} />

        {isStudentHome ? (
          <div className="w-full min-h-screen flex flex-col" style={{ paddingTop: localStorage.getItem('manar_super_admin_token') ? '40px' : '0px' }}>
            {studentRoutes}
          </div>
        ) : (
          <div className="w-full max-w-md min-h-screen flex flex-col relative pb-24 z-10" style={{ paddingTop: localStorage.getItem('manar_super_admin_token') ? '104px' : '64px', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
            
            {/* Student top header */}
            <header
              className="fixed z-40 flex items-center justify-between px-5 glass-header"
              style={{
                top: localStorage.getItem('manar_super_admin_token') ? '40px' : '0px',
                width: 'inherit', maxWidth: '448px',
                height: '64px',
              }}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {renderLogo('sm')}
                <span className="text-xs font-black tracking-wider uppercase truncate" style={{ color: 'var(--accent)' }}>
                  {getBrandedTitle(isAr)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ThemeSwitcher />
                <button
                  onClick={() => i18n.changeLanguage(isAr ? 'en' : 'ar')}
                  className="btn-ghost px-3 py-1 text-[10px] tracking-widest uppercase"
                >
                  {isAr ? 'EN' : 'عربي'}
                </button>
              </div>
            </header>

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-y-auto">
              {studentRoutes}
            </div>

            {/* Premium floating glass nav dock */}
            <nav
              className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center"
              style={{
                width: 'calc(100% - 2rem)', maxWidth: '400px',
                background: 'var(--bg-card)',
                backdropFilter: 'blur(24px)',
                border: '1px solid var(--border-color)',
                borderRadius: '20px',
                padding: '10px 16px',
                gap: '4px',
                boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02) inset',
              }}
            >
              {[
                { to: '/student/home',          icon: '🏠', label: t('nav.home') },
                ...(user?.isRepresentative ? [{ to: '/student/representative', icon: '👥', label: isAr ? 'المندوب' : 'Rep' }] : []),
              ].map(({ to, icon, label }) => {
                const active = path === to;
                return (
                  <Link key={to} to={to}
                    className="flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all duration-200 relative"
                    style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }}
                  >
                    <span className="text-[17px] leading-none mb-0.5">{icon}</span>
                    <span className="text-[9px] font-black tracking-wide">{label}</span>
                    {active && <span className="absolute bottom-0.5 h-0.5 w-4 rounded-full" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />}
                  </Link>
                );
              })}
              <button
                onClick={handleLogoutClick}
                className="flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all duration-200"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                <span className="text-[17px] leading-none mb-0.5">🚪</span>
                <span className="text-[9px] font-black tracking-wide">{t('nav.logout')}</span>
              </button>
            </nav>
          </div>
        )}

        <ConfirmationModal
          isOpen={isLogoutModalOpen}
          title={isAr ? 'تأكيد الخروج' : 'Confirm Sign Out'}
          message={isAr ? 'هل أنت متأكد من الخروج؟' : 'Are you sure you want to sign out?'}
          onConfirm={confirmLogout}
          onCancel={() => setIsLogoutModalOpen(false)}
          confirmText={isAr ? 'خروج' : 'Sign Out'}
          cancelText={isAr ? 'إلغاء' : 'Cancel'}
        />
      </div>
    );
  }

  // Welcome / Default Landing Page Layout
  return (
    <div style={{ paddingTop: localStorage.getItem('manar_super_admin_token') ? '40px' : '0px' }}>
      {renderImpersonationBanner()}
      <Routes>
        <Route path="/"               element={<Navigate to="/c/almanar-college" replace />} />
        <Route path="/u/:uniSlug"     element={<PublicLandingWizard />} />
        <Route path="/c/:collegeSlug" element={<PublicLandingWizard />} />
        <Route path="/login"          element={<Login />} />
        <Route path="/teacher-login"  element={<TeacherLogin />} />
        <Route path="/register"       element={<Register />} />
        <Route path="/verify"         element={<Verification />} />
        <Route path="/instructions"   element={<Instructions />} />
        <Route path="/link-google"    element={<GoogleLinkInterceptor />} />
        <Route path="/license-suspended" element={<LicenseSuspended />} />
        <Route path="*"               element={<Navigate to="/c/almanar-college" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <OfflineBanner />
        <ErrorBoundary>
          <React.Suspense fallback={<PageLoader />}>
            <AppLayout />
          </React.Suspense>
        </ErrorBoundary>
        <CommandPalette />
        <ProgressLoader />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              fontFamily: 'Urbanist, system-ui, sans-serif',
              fontWeight: '700',
              fontSize: '13px',
              borderRadius: '12px',
            },
          }}
        />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
