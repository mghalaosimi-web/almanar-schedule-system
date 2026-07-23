/**
 * @file StudentDashboard.jsx
 * @description المكون الإداري المركزي المنسق لتبويبات وحالة بوابة الطالب (Student Dashboard Orchestrator).
 * يتكفل بإدارة الحالة العامة للبيانات، الاتصال بالخادم، مستمع الأحداث الحية، مزامنة إنذارات الخلفية PWA، وتوزيع المدخلات والعمليات على التبويبات المتخصصة.
 * @author أنتيجرافيتي (Antigravity)
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from './config';
import usePWAInstall from './usePWAInstall';
import ThemeSwitcher from './ThemeSwitcher';
import ConfirmationModal from './ConfirmationModal';
import UserSettings from './UserSettings';
import RepresentativeDashboard from './RepresentativeDashboard';
import { scheduleOfflineNotifications } from './utils/localNotifications';
import { getFriendlyErrorMessage } from './utils/errorHelpers';

// استيراد المكونات المقسمة والمفككة للتبويبات الفرعية للطالب
import HomeTab from './components/student/HomeTab';
import ScheduleTab from './components/student/ScheduleTab';
import DelegateTab from './components/student/DelegateTab';
import ProfileTab from './components/student/ProfileTab';
import ExchangeHubTab from './components/student/ExchangeHubTab';
import GoalsTab from './components/student/GoalsTab';

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const SCHED_DAYS = ['SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];

/**
 * دالة لاستخلاص اليوم الدراسي الفعلي للمحاضرة مع مراعاة التعديلات الاستثنائية المؤقتة.
 * @param {Object} schedule - كائن الحصة الدراسية.
 * @returns {string} اسم اليوم باللغة الإنجليزية (كبير الحروف).
 */
const getActiveDay = (schedule) => {
  if (schedule.overrides && schedule.overrides.length > 0) {
    const latest = schedule.overrides[schedule.overrides.length - 1];
    const date = new Date(latest.date);
    return DAYS[date.getDay()];
  }
  return schedule.dayOfWeek;
};

/**
 * دالة لاستخلاص وقت بدء المحاضرة الفعلي مع مراعاة التعديلات الاستثنائية المؤقتة.
 * @param {Object} s - كائن الحصة الدراسية.
 * @returns {string} وقت البدء بصيغة (HH:MM).
 */
const getActiveStartTime = (s) => {
  if (s.overrides && s.overrides.length > 0) {
    const l = s.overrides[s.overrides.length - 1];
    return l.newStartTime || s.startTime;
  }
  return s.startTime;
};

/**
 * دالة لاستخلاص وقت انتهاء المحاضرة الفعلي مع مراعاة التعديلات الاستثنائية المؤقتة.
 * @param {Object} s - كائن الحصة الدراسية.
 * @returns {string} وقت الانتهاء بصيغة (HH:MM).
 */
const getActiveEndTime = (s) => {
  if (s.overrides && s.overrides.length > 0) {
    const l = s.overrides[s.overrides.length - 1];
    return l.newEndTime || s.endTime;
  }
  return s.endTime;
};

/**
 * دالة للتحقق مما إذا كانت المحاضرة تحتوي على تعديل أو استثناء نشط حالياً.
 * @param {Object} s - كائن الحصة الدراسية.
 * @returns {boolean}
 */
const isOverridden = (s) => s.overrides && s.overrides.length > 0;

/**
 * حساب العد التنازلي التفاعلي المتبقي بدقة لأقرب محاضرة قادمة.
 * @param {Object} nextLec - كائن المحاضرة القادمة.
 * @param {boolean} isAr - ما إذا كانت الواجهة معربة.
 * @returns {string} نص العد التنازلي المنسق بالثواني والدقائق والساعات.
 */
const getCountdownString = (nextLec, isAr) => {
  if (!nextLec) return '';
  const now = new Date();
  const targetDayName = getActiveDay(nextLec);
  const targetTimeStr = getActiveStartTime(nextLec);
  const [targetHour, targetMinute] = targetTimeStr.split(':').map(Number);

  const DAYS_MAP = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
  const targetDayIndex = DAYS_MAP[targetDayName];
  const currentDayIndex = now.getDay();

  let daysDiff = targetDayIndex - currentDayIndex;
  if (daysDiff < 0 || (daysDiff === 0 && (now.getHours() > targetHour || (now.getHours() === targetHour && now.getMinutes() >= targetMinute)))) {
    daysDiff += 7;
  }

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysDiff);
  targetDate.setHours(targetHour, targetMinute, 0, 0);

  const diffMs = targetDate - now;
  if (diffMs <= 0) return isAr ? 'بدأت الآن' : 'Starting now';

  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (diffHrs >= 24) {
    const days = Math.floor(diffHrs / 24);
    return isAr ? `بعد ${days} يوم` : `in ${days} days`;
  }

  const pad = (num) => String(num).padStart(2, '0');
  return `${pad(diffHrs)}:${pad(diffMins)}:${pad(diffSecs)}`;
};

/**
 * مكون فرعي لعرض شاشة التنبيه للميزات غير المكتملة أو المعطلة من قبل الإدارة.
 */
const UnderDevelopmentView = ({ isAr, featureNameAr, featureNameEn }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="frosted-panel rounded-3xl p-8 border border-white/5 bg-white/2 text-center space-y-6 max-w-md mx-auto my-8 relative overflow-hidden"
      style={{ background: 'var(--bg-card, #121824)', border: '1px solid var(--border-card, rgba(255,255,255,0.05))' }}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-[var(--accent)]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="w-16 h-16 rounded-2xl bg-amber-550/10 border border-amber-500/20 flex items-center justify-center text-3xl mx-auto shadow-inner">
        🚧
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-black text-white">
          {isAr ? `قسم ${featureNameAr} قيد التطوير` : `${featureNameEn} Section Under Development`}
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed font-bold">
          {isAr
            ? 'هذه الميزة معطلة مؤقتاً من قبل الإدارة لإجراء التحديثات وأعمال الصيانة. يرجى العودة لاحقاً.'
            : 'This feature is temporarily disabled by the administration for upgrades and maintenance. Please check back later.'}
        </p>
      </div>
      <div className="pt-2">
        <span className="inline-block px-3 py-1 rounded-full border border-amber-500/20 bg-amber-950/30 text-amber-400 text-[10px] font-black uppercase tracking-wider font-mono">
          ● Under Maintenance / قيد الصيانة
        </span>
      </div>
    </motion.div>
  );
};

export default function StudentDashboard() {
  // ── مؤقت النظام والساعة الرقمية ──
  const [systemTime, setSystemTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setSystemTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const formattedTime = systemTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const formattedDate = systemTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const { isInstallable, installApp } = usePWAInstall();

  // ── حالات الحالة العامة (Core States) ──
  const [activeTab, setActiveTab] = useState('home');
  const [systemSettings, setSystemSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_system_settings');
      return saved ? JSON.parse(saved) : {
        disableAttendance: false,
        disableSchedules: false,
        disableExams: false,
        disableLibrary: false,
        disableMap: false,
      };
    } catch {
      return {
        disableAttendance: false,
        disableSchedules: false,
        disableExams: false,
        disableLibrary: false,
        disableMap: false,
      };
    }
  });

  // التحكم في السمات والمظهر البصري
  const [isDark, setIsDark] = useState(() => localStorage.getItem('manar_theme_mode') !== 'light');
  useEffect(() => {
    const handleModeChange = () => {
      setIsDark(localStorage.getItem('manar_theme_mode') !== 'light');
    };
    window.addEventListener('themeModeChanged', handleModeChange);
    return () => window.removeEventListener('themeModeChanged', handleModeChange);
  }, []);

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [originalSchedules, setOriginalSchedules] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [subjectStats, setSubjectStats] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [alertFilter, setAlertFilter] = useState('All');
  
  // Goals and Reminders states
  const [studentGoals, setStudentGoals] = useState([]);
  const [studentGoalsLoading, setStudentGoalsLoading] = useState(false);
  const [goalReminders, setGoalReminders] = useState([]);

  // حالات ملتقى الشعبة والنقاشات (Exchange Hub)
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [exchangeSearch, setExchangeSearch] = useState('');
  const [exchangeCategoryFilter, setExchangeCategoryFilter] = useState('ALL');
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedPostLoading, setSelectedPostLoading] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState('GENERAL');
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [profileViewMode, setProfileViewMode] = useState('main'); // 'main' | 'edit' | 'feedback' | 'library' | 'map'

  useEffect(() => {
    setProfileViewMode('main');
  }, [activeTab]);

  // حالات محاكي التعديل والجدولة التجريبية (Sandbox Simulator)
  const [sandboxMode, setSandboxMode] = useState(false);
  const [activeSimulatorSchedule, setActiveSimulatorSchedule] = useState(null);
  const [simulatorDay, setSimulatorDay] = useState('SUNDAY');
  const [simulatorStart, setSimulatorStart] = useState('08:00');
  const [simulatorEnd, setSimulatorEnd] = useState('10:00');

  // نص مؤقت العداد التنازلي
  const [countdown, setCountdown] = useState('');

  // تهيئة وتجهيز ملف بيانات الطالب المحتفظ بها
  const getInitialProfile = () => {
    const userJson = localStorage.getItem('manar_user');
    let base = { name: 'Student', email: '', phone: '', idPhotoUrl: '', department: '', level: '', groupId: 1, groupName: 'Group A', isRepresentative: false, xp: 350, streak: 7, isFocusing: false };
    if (userJson) {
      try {
        const u = JSON.parse(userJson);
        base = { ...base, name: u.name || base.name, email: u.email || '', phone: u.phone || '', idPhotoUrl: u.idPhotoUrl || '', groupId: u.groupId || 1, isRepresentative: u.isRepresentative || false };
      } catch {}
    }
    const saved = localStorage.getItem('student_profile');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        return { ...base, ...p };
      } catch {}
    }
    return base;
  };
  const [profile, setProfile] = useState(getInitialProfile);

  /**
   * دالة إنهاء الدورة وتسجيل خروج الطالب وتطهير ذاكرة التخزين المحلية.
   */
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

  // ── مستمعو حالة الاتصال التفاعلية والتنبيهات ──
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    
    const onForceSyncMessage = (event) => {
      if (event.data && event.data.type === 'FORCE_SCHEDULE_SYNC') {
        console.log('[StudentDashboard] SW requested force sync:', event.data.reason);
        fetchData(true);
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onForceSyncMessage);
    }
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onForceSyncMessage);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // مستمع التنبيهات المباشر عند قرب بدء المحاضرات (تذكير تفاعلي مؤقت)
  useEffect(() => {
    const checkUpcomingLecture = () => {
      if (!schedules.length) return;
      const now = new Date();
      const dayMap = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
      const today = dayMap[now.getDay()];
      const todayLecs = schedules.filter(s => (s.overrides?.[0]?.dayOfWeek || s.dayOfWeek) === today);
      todayLecs.forEach(lec => {
        const start = lec.overrides?.[0]?.startTime || lec.startTime;
        const [h, m] = start.split(':').map(Number);
        const lecMinutes = h * 60 + m;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const diff = lecMinutes - nowMinutes;
        if (diff >= 10 && diff <= 11 && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(isAr ? '⏰ محاضرة قادمة!' : '⏰ Upcoming Lecture!', {
            body: isAr
              ? (`محاضرة ${lec.subject?.name || ''} تبدأ خلال 10 دقائق - قاعة ${lec.room?.name || ''}`)
              : (`${lec.subject?.name || ''} starts in 10 minutes - ${lec.room?.name || ''}`),
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
          });
        }
      });
    };
    checkUpcomingLecture();
    const notifTimer = setInterval(checkUpcomingLecture, 30000);
    return () => clearInterval(notifTimer);
  }, [schedules, isAr]);

  const fetchGoalsReminders = () => {
    const token = localStorage.getItem('manar_token');
    if (!token) return;
    axios.get(`${API_URL}/api/goals/reminders`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (res.data?.success) {
        setGoalReminders(res.data.data);
      }
    }).catch(err => {
      console.warn('[Reminders] Failed to fetch reminders:', err.message);
    });
  };

  /**
   * جلب وتحديث كافة بيانات الطالب والجدول الدراسي والإحصائيات الحية.
   * @param {boolean} forceRefresh - ما إذا كان التحديث إجبارياً ويتجاوز الذاكرة المخبأة.
   */
  const fetchData = async (forceRefresh = false) => {
    const cacheTs = parseInt(localStorage.getItem('cached_student_ts') || '0');
    const isFresh = Date.now() - cacheTs < 5 * 60 * 1000;

    // محاولة تحميل البيانات المخبأة محلياً أولاً لتجنب الوميض المزعج (Layout Flash)
    const cachedSchedules = localStorage.getItem('cached_student_schedules');
    let hasLoadedFromCache = false;
    if (cachedSchedules) {
      try {
        const parsed = JSON.parse(cachedSchedules);
        setSchedules(parsed);
        setOriginalSchedules(parsed);
        hasLoadedFromCache = true;
      } catch {}
    }
    const cachedStats = localStorage.getItem('cached_student_stats');
    if (cachedStats) {
      try { setAttendanceStats(JSON.parse(cachedStats)); } catch {}
    }
    const cachedSubjectStats = localStorage.getItem('cached_student_subject_stats');
    if (cachedSubjectStats) {
      try { setSubjectStats(JSON.parse(cachedSubjectStats)); } catch {}
    }
    const cachedNotifications = localStorage.getItem('cached_student_notifications');
    if (cachedNotifications) {
      try { setNotifications(JSON.parse(cachedNotifications)); } catch {}
    }

    // عدم جلب البيانات من الشبكة إن كانت مخزنة وتاريخها لم يتجاوز 5 دقائق
    if (isFresh && hasLoadedFromCache && !forceRefresh) {
      setLoading(false);
      console.log('[StudentDashboard] Cache is fresh (<5 min). Network fetch skipped.');
      return;
    }

    if (!navigator.onLine && hasLoadedFromCache) {
      setLoading(false);
      console.log('[StudentDashboard] Offline — serving from cache.');
      return;
    }

    try {
      if (!hasLoadedFromCache) {
        setLoading(true);
      }
      const token = localStorage.getItem('manar_token');
      
      const profileRes = await axios.get(`${API_URL}/api/student/settings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      let s = getInitialProfile();
      if (profileRes.data?.success) {
        s = profileRes.data.data;
        setProfile(p => ({
          ...p,
          name: s.name || p.name,
          email: s.email || p.email,
          phone: s.phone || p.phone,
          idPhotoUrl: s.idPhotoUrl || p.idPhotoUrl,
          department: s.departmentName || s.majorName || p.department,
          level: s.levelName || p.level,
          groupId: s.groupId || p.groupId,
          groupName: s.groupName || p.groupName,
          majorId: s.majorId,
          levelId: s.levelId,
          isEmailVerified: s.isEmailVerified !== undefined ? s.isEmailVerified : p.isEmailVerified,
          isPhoneVerified: s.isPhoneVerified !== undefined ? s.isPhoneVerified : p.isPhoneVerified,
          isRepresentative: s.isRepresentative !== undefined ? s.isRepresentative : p.isRepresentative,
          xp: s.xp !== undefined ? s.xp : p.xp,
          streak: s.streak !== undefined ? s.streak : p.streak,
          isFocusing: s.isFocusing !== undefined ? s.isFocusing : p.isFocusing
        }));
      }

      const majorId = s.majorId;
      const levelId = s.levelId;
      const studentGroupId = s.groupId;

      const schedulesUrl = majorId && levelId
        ? `${API_URL}/api/schedules?majorId=${majorId}&levelId=${levelId}`
        : `${API_URL}/api/schedules?groupId=${studentGroupId || 1}`;
        
      const groupsUrl = majorId && levelId
        ? `${API_URL}/api/groups?majorId=${majorId}&levelId=${levelId}`
        : `${API_URL}/api/groups`;

      // تنفيذ استعلامات متوازية لتقليل زمن الاستجابة الكلي (Latency)
      const [schedRes, groupsRes, statsRes, notifRes, subjectStatsRes, settingsRes, goalsRes] = await Promise.all([
        axios.get(schedulesUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        axios.get(groupsUrl).catch(() => null),
        axios.get(`${API_URL}/api/student/attendance/stats`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }).catch(() => null),
        axios.get(`${API_URL}/api/notifications/student`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }).catch(() => null),
        axios.get(`${API_URL}/api/student/attendance-stats`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }).catch(() => null),
        axios.get(`${API_URL}/api/auth/system/settings`).catch(() => null),
        axios.get(`${API_URL}/api/student/tasks/all`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }).catch(() => null)
      ]);

      if (settingsRes?.data?.success) {
        setSystemSettings(settingsRes.data.settings);
        localStorage.setItem('cached_system_settings', JSON.stringify(settingsRes.data.settings));
      }

      let officialScheds = [];
      if (schedRes.data?.success) {
        officialScheds = schedRes.data.data;
        localStorage.setItem('cached_student_schedules', JSON.stringify(officialScheds));
        localStorage.setItem('cached_student_ts', Date.now().toString());

        // مزامنة محلياً وتحديث محرك إنذارات الـ Service Worker في الخلفية
        try {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready.catch(() => null);
            if (reg && reg.active) {
              const alertTogglesRaw = localStorage.getItem('student_alert_toggles');
              let alertSettings = { preAlertTime: '15', language: isAr ? 'ar' : 'en' };
              try {
                const toggles = JSON.parse(alertTogglesRaw || '{}');
                alertSettings = { preAlertTime: toggles.preAlertTime || '15', language: isAr ? 'ar' : 'en' };
              } catch {}
              reg.active.postMessage({
                type: 'SCHEDULE_CACHE_UPDATE',
                schedules: officialScheds,
                settings: alertSettings
              });
            }
          }
        } catch (swErr) {
          console.warn('[StudentDashboard] SW schedule sync failed:', swErr);
        }

        window.dispatchEvent(new CustomEvent('MANAR_DATA_SYNCED'));
      }
      setOriginalSchedules(officialScheds);

      const isSandbox = localStorage.getItem('manar_sandbox_mode') === 'true';
      setSandboxMode(isSandbox);
      if (isSandbox) {
        const savedSandbox = localStorage.getItem('manar_sandbox_schedules');
        if (savedSandbox) {
          try { setSchedules(JSON.parse(savedSandbox)); } catch { setSchedules(officialScheds); }
        } else {
          setSchedules(officialScheds);
        }
      } else {
        setSchedules(officialScheds);
      }

      if (groupsRes?.data?.success) {
        setGroups(groupsRes.data.data);
        if (studentGroupId && groupsRes.data.data.some(g => g.id === studentGroupId)) {
          setSelectedGroupFilter(studentGroupId);
        } else {
          setSelectedGroupFilter('all');
        }
      }

      if (statsRes?.data?.success) {
        setAttendanceStats(statsRes.data.data);
        localStorage.setItem('cached_student_stats', JSON.stringify(statsRes.data.data));
      }

      if (subjectStatsRes?.data?.success) {
        setSubjectStats(subjectStatsRes.data.data);
        localStorage.setItem('cached_student_subject_stats', JSON.stringify(subjectStatsRes.data.data));
      }

      if (notifRes?.data?.success) {
        setNotifications(notifRes.data.data);
        localStorage.setItem('cached_student_notifications', JSON.stringify(notifRes.data.data));
      }

      if (goalsRes?.data?.success) {
        const { personal, academic } = goalsRes.data.data;
        const mappedPersonal = (personal || []).map(t => ({
          id: t.id,
          title: t.title,
          description: '',
          dueDate: t.dueDate,
          completed: t.completed,
          type: t.category || 'PERSONAL',
          isPersonal: true
        }));
        const mappedAcademic = (academic || []).map(g => ({
          id: g.id,
          title: g.title,
          description: '',
          dueDate: g.dueDate,
          completed: g.completed,
          type: g.category || 'ASSIGNMENT',
          subject: { name: g.subjectName }
        }));
        setStudentGoals([...mappedPersonal, ...mappedAcademic]);
      }
      fetchGoalsReminders();
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      const cached = localStorage.getItem('cached_student_schedules');
      if (cached) {
        toast(isAr ? 'تم تحميل البيانات المخزنة مؤقتاً (وضع غير متصل بالإنترنت)' : 'Displaying offline cached data', { icon: '📡' });
      } else {
        const msg = getFriendlyErrorMessage(err, isAr ? 'فشل تحميل بيانات لوحة التحكم' : 'Failed to load dashboard data', isAr);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // التحديث الفوري الموجه عبر قنوات SSE للأحداث الحية
    const onUpdate = () => { fetchData(true); };
    window.addEventListener('MANAR_SCHEDULE_UPDATE', onUpdate);
    window.addEventListener('MANAR_BROADCAST_RECEIVE', onUpdate);
    window.addEventListener('MANAR_ATTENDANCE_MARKED', onUpdate);
    return () => {
      window.removeEventListener('MANAR_SCHEDULE_UPDATE', onUpdate);
      window.removeEventListener('MANAR_BROADCAST_RECEIVE', onUpdate);
      window.removeEventListener('MANAR_ATTENDANCE_MARKED', onUpdate);
    };
  }, []);

  // Live exchange synchronization via SSE events
  useEffect(() => {
    const handlePostCreated = (e) => {
      const { groupId, post } = e.detail;
      const userJson = localStorage.getItem('manar_user');
      let currentUser = null;
      try { currentUser = JSON.parse(userJson); } catch {}
      if (currentUser && currentUser.groupId === groupId) {
        setPosts(prev => {
          if (prev.some(p => p.id === post.id)) return prev;
          return [post, ...prev];
        });
      }
    };

    const handlePostDeleted = (e) => {
      const { groupId, postId } = e.detail;
      const userJson = localStorage.getItem('manar_user');
      let currentUser = null;
      try { currentUser = JSON.parse(userJson); } catch {}
      if (currentUser && currentUser.groupId === groupId) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        setSelectedPost(prev => prev && prev.id === postId ? null : prev);
      }
    };

    const handleCommentCreated = (e) => {
      const { groupId, postId, comment } = e.detail;
      const userJson = localStorage.getItem('manar_user');
      let currentUser = null;
      try { currentUser = JSON.parse(userJson); } catch {}
      if (currentUser && currentUser.groupId === groupId) {
        // Update posts list comments count
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            const count = (p._count?.comments || 0) + 1;
            return { ...p, _count: { ...p._count, comments: count } };
          }
          return p;
        }));
        // Update selected post comments list
        setSelectedPost(prev => {
          if (prev && prev.id === postId) {
            const comments = prev.comments || [];
            if (comments.some(c => c.id === comment.id)) return prev;
            return { ...prev, comments: [...comments, comment] };
          }
          return prev;
        });
      }
    };

    const handleCommentDeleted = (e) => {
      const { groupId, postId, commentId } = e.detail;
      const userJson = localStorage.getItem('manar_user');
      let currentUser = null;
      try { currentUser = JSON.parse(userJson); } catch {}
      if (currentUser && currentUser.groupId === groupId) {
        // Update posts list comments count
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            const count = Math.max(0, (p._count?.comments || 0) - 1);
            return { ...p, _count: { ...p._count, comments: count } };
          }
          return p;
        }));
        // Update selected post comments list
        setSelectedPost(prev => {
          if (prev && prev.id === postId) {
            return {
              ...prev,
              comments: (prev.comments || []).filter(c => c.id !== commentId)
            };
          }
          return prev;
        });
      }
    };

    window.addEventListener('MANAR_EXCHANGE_POST_CREATED', handlePostCreated);
    window.addEventListener('MANAR_EXCHANGE_POST_DELETED', handlePostDeleted);
    window.addEventListener('MANAR_EXCHANGE_COMMENT_CREATED', handleCommentCreated);
    window.addEventListener('MANAR_EXCHANGE_COMMENT_DELETED', handleCommentDeleted);

    return () => {
      window.removeEventListener('MANAR_EXCHANGE_POST_CREATED', handlePostCreated);
      window.removeEventListener('MANAR_EXCHANGE_POST_DELETED', handlePostDeleted);
      window.removeEventListener('MANAR_EXCHANGE_COMMENT_CREATED', handleCommentCreated);
      window.removeEventListener('MANAR_EXCHANGE_COMMENT_DELETED', handleCommentDeleted);
    };
  }, []);

  // إعادة جدولة المنبهات المحلية عند تبدل قائمة الجداول
  useEffect(() => {
    if (schedules && schedules.length > 0) {
      scheduleOfflineNotifications(schedules, isAr);
    }
  }, [schedules, isAr]);

  // ── معالجة حركة التحديث بالسحب (Pull to Refresh) ──
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = React.useRef(0);
  const PULL_THRESHOLD = 80;

  const handleTouchStart = (e) => {
    if (window.scrollY === 0) touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    if (window.scrollY !== 0 || !touchStartY.current) return;
    const dist = e.touches[0].clientY - touchStartY.current;
    if (dist > 0 && dist < 200) setPullDistance(dist);
  };

  const handleTouchEnd = () => {
    if (pullDistance >= PULL_THRESHOLD) {
      setIsPulling(true);
      fetchData(true).finally(() => {
        setIsPulling(false);
        setPullDistance(0);
        touchStartY.current = 0;
        toast.success(isAr ? 'تم تحديث البيانات' : 'Data refreshed!');
      });
    } else {
      setPullDistance(0);
      touchStartY.current = 0;
    }
  };

  // ── معالجات محاكي الجدولة الافتراضية (Sandbox) ──
  const handleSimulateReschedule = (e) => {
    e.preventDefault();
    if (!activeSimulatorSchedule) return;
    const updated = schedules.map(s =>
      s.id === activeSimulatorSchedule.id
        ? { ...s, dayOfWeek: simulatorDay, startTime: simulatorStart, endTime: simulatorEnd, overrides: [] }
        : s
    );
    setSchedules(updated);
    localStorage.setItem('manar_sandbox_schedules', JSON.stringify(updated));
    setActiveSimulatorSchedule(null);
    window.dispatchEvent(new Event('MANAR_SANDBOX_UPDATE'));
    toast.success(isAr ? 'تمت المحاكاة بنجاح!' : 'Simulation applied!');
  };

  const toggleSandbox = () => {
    localStorage.removeItem('manar_sandbox_mode');
    localStorage.removeItem('manar_sandbox_schedules');
    setSandboxMode(false);
    setSchedules(originalSchedules);
    window.dispatchEvent(new Event('MANAR_SANDBOX_UPDATE'));
    toast.success(isAr ? 'تم استعادة الجدول الرسمي!' : 'Official timetable restored!');
  };

  const toggleSandboxFromButton = () => {
    if (sandboxMode) {
      toggleSandbox();
    } else {
      localStorage.setItem('manar_sandbox_mode', 'true');
      localStorage.setItem('manar_sandbox_schedules', JSON.stringify(schedules));
      setSandboxMode(true);
      window.dispatchEvent(new Event('MANAR_SANDBOX_UPDATE'));
      toast.success(isAr ? 'محاكي نشط! انتقل للصفحة الرئيسية لتجربة تعديل الحصص.' : 'Simulator active! Go to Home screen to reschedule.', { icon: '🧪' });
    }
  };

  // ── تصدير ومشاركة الجدول بصيغ متعددة ──
  const handleExportICS = async () => {
    try {
      const token = localStorage.getItem('manar_token');
      if (!token) {
        toast.error(isAr ? 'يجب تسجيل الدخول أولاً' : 'You must be logged in first');
        return;
      }
      const groupName = profile.groupId ? (groups.find(g => g.id === profile.groupId)?.name || 'Student') : 'Student';
      const toastId = toast.loading(isAr ? 'جاري تصدير الملف...' : 'Exporting calendar...');
      const res = await axios.get(`${API_URL}/api/student/export-schedule`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'text'
      });
      
      const blob = new Blob([res.data], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Manar_Schedule_${groupName}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(isAr ? 'تم تصدير ملف التقويم بنجاح!' : 'Calendar exported successfully!', { id: toastId });
    } catch (err) {
      console.error('Failed to export schedule:', err);
      toast.error(isAr ? 'فشل تصدير الجدول من الخادم' : 'Failed to export schedule from server');
    }
  };

  const handlePrintPDF = () => {
    toast.success(isAr ? 'جاري فتح نافذة الطباعة... اختر حفظ كملف PDF' : 'Opening print window... Choose Save as PDF');
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const buildScheduleText = () => {
    const dayLabels = isAr
      ? { SUNDAY: 'الأحد', MONDAY: 'الاثنين', TUESDAY: 'الثلاثاء', WEDNESDAY: 'الأربعاء', THURSDAY: 'الخميس', FRIDAY: 'الجمعة', SATURDAY: 'السبت' }
      : { SUNDAY: 'Sunday', MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday' };
    let text = isAr ? `📅 الجدول الدراسي — بوابة الطالب الجامعي\n` : `📅 Class Schedule — University Student Portal\n`;
    DAYS.forEach(day => {
      const ds = schedules.filter(s => getActiveDay(s) === day);
      if (ds.length > 0) {
        text += `\n🔹 ${dayLabels[day]}:\n`;
        ds.forEach(s => {
          text += `   [${getActiveStartTime(s)}-${getActiveEndTime(s)}] ${s.subject.name} | ${s.room?.name || 'N/A'} | ${s.lecturerName}\n`;
        });
      }
    });
    text += `\n— ${isAr ? 'بوابة الطالب الذكية' : 'Smart Student Portal'} 💡`;
    return text;
  };

  const handleShareSchedule = async () => {
    if (schedules.length === 0) {
      toast.error(isAr ? 'الجدول فارغ' : 'Schedule is empty');
      return;
    }
    const text = buildScheduleText();
    if (navigator.share) {
      try {
        await navigator.share({ title: isAr ? 'جدولي الدراسي — بوابة الطالب' : 'My Schedule — Student Portal', text });
        toast.success(isAr ? 'تمت المشاركة!' : 'Shared!');
      } catch (e) { if (e.name !== 'AbortError') toast.error(isAr ? 'فشلت المشاركة' : 'Share failed'); }
    } else {
      navigator.clipboard.writeText(text)
        .then(() => toast.success(isAr ? 'تم نسخ الجدول!' : 'Copied to clipboard!'))
        .catch(() => toast.error(isAr ? 'فشل النسخ' : 'Copy failed'));
    }
  };

  const handleTestNotification = async () => {
    if (!('Notification' in window)) {
      toast.error(isAr ? 'التنبيهات غير مدعومة في هذا المتصفح' : 'Notifications not supported in this browser');
      return;
    }

    const sendNative = () => {
      new Notification(
        isAr ? 'بوابة الطالب الجامعي' : 'University Student Portal',
        {
          body: isAr ? 'هذا تنبيه تجريبي، النظام يعمل بنجاح!' : 'This is a test notification, the system is working successfully!',
          icon: '/pwa-192x192.png',
          vibrate: [200, 100, 200]
        }
      );
      toast.success(isAr ? 'تم إرسال التنبيه التجريبي!' : 'Test notification sent!');
    };

    if (Notification.permission === 'granted') {
      sendNative();
    } else if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          sendNative();
        } else {
          toast.error(isAr ? 'لم يتم منح إذن التنبيهات' : 'Notification permission denied');
        }
      } catch (err) {
        console.error('Permission request failed', err);
      }
    } else {
      toast.error(isAr ? 'التنبيهات محظورة في إعدادات المتصفح' : 'Notifications blocked in browser settings');
    }
  };

  const handleCheckUpdates = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.update());
      });
    }
    toast.success(isAr ? 'جاري التحقق من وجود تحديثات...' : 'Checking for updates...', { icon: '🔄' });
  };

  const handleManualSync = async () => {
    window.dispatchEvent(new CustomEvent('large-operation-start', { 
      detail: { 
        message: isAr ? 'جاري تنزيل التحديث والمزامنة...' : 'Downloading update & syncing...' 
      } 
    }));
    
    try {
      await fetchData(true);
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.update().catch(err => console.warn('SW update error:', err));
        }
      }
      toast.success(isAr ? 'تم تحديث البيانات بنجاح!' : 'Data successfully updated!');
    } catch (err) {
      console.error(err);
      toast.error(isAr ? 'فشل تحديث البيانات' : 'Failed to update data');
    } finally {
      window.dispatchEvent(new CustomEvent('large-operation-end'));
    }
  };

  const handleToggleGoal = async (goalId) => {
    try {
      const token = localStorage.getItem('manar_token');
      const goal = studentGoals.find(g => g.id === goalId);
      if (!goal) return;

      const res = await axios.put(`${API_URL}/api/student/tasks/${goalId}`, {
        completed: !goal.completed
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم تحديث حالة المهمة!' : 'Task updated successfully!');
        if (res.data.xpAwarded) {
          toast.success(isAr ? `🏆 حصلت على +${res.data.xpAwarded} نقطة XP!` : `🏆 Earned +${res.data.xpAwarded} XP!`, { icon: '✨' });
        }
        fetchData(true);
      }
    } catch (err) {
      console.error(err);
      toast.error(isAr ? 'فشل تحديث حالة المهمة.' : 'Failed to update task state.');
    }
  };

  const handleAddPersonalTask = async (title, dueDate, category) => {
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/student/tasks`, {
        title,
        dueDate,
        category
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم إضافة المهمة الشخصية!' : 'Personal task added successfully!');
        fetchData(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error creating personal task:', err);
      toast.error(isAr ? 'فشل إضافة المهمة.' : 'Failed to add task.');
      return false;
    }
  };

  const handleDeletePersonalTask = async (taskId) => {
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.delete(`${API_URL}/api/student/tasks/${taskId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم حذف المهمة!' : 'Task deleted successfully!');
        fetchData(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting task:', err);
      toast.error(isAr ? 'فشل حذف المهمة.' : 'Failed to delete task.');
      return false;
    }
  };

  // ── معالجات ملتقى النقاشات والشعبة (Exchange Hub APIs) ──
  const fetchPosts = async () => {
    try {
      setPostsLoading(true);
      const token = localStorage.getItem('manar_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [forumRes, chatRes] = await Promise.all([
        axios.get(`${API_URL}/api/exchange/posts?excludeCategory=GENERAL`, { headers }),
        axios.get(`${API_URL}/api/exchange/posts?category=GENERAL&limit=50`, { headers })
      ]);

      let allCombined = [];
      if (forumRes.data?.success) {
        allCombined = [...forumRes.data.data];
      }
      if (chatRes.data?.success) {
        allCombined = [...allCombined, ...chatRes.data.data];
      }
      setPosts(allCombined);
    } catch (err) {
      console.error('Error fetching exchange posts:', err);
      toast.error(isAr ? 'فشل تحميل مواضيع الملتقى' : 'Failed to fetch discussion topics');
    } finally {
      setPostsLoading(false);
    }
  };

  const fetchPostDetails = async (postId) => {
    try {
      setSelectedPostLoading(true);
      const token = localStorage.getItem('manar_token');
      const res = await axios.get(`${API_URL}/api/exchange/posts/${postId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        setSelectedPost(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching post details:', err);
      toast.error(isAr ? 'فشل تحميل تفاصيل الموضوع' : 'Failed to load thread details');
    } finally {
      setSelectedPostLoading(false);
    }
  };

  const handleCreatePost = async (titleOrEvent, contentParam, categoryParam, isAnonymousParam) => {
    let title = "";
    let content = "";
    let category = "GENERAL";
    let isAnonymous = false;

    if (titleOrEvent && typeof titleOrEvent.preventDefault === 'function') {
      titleOrEvent.preventDefault();
      title = newPostTitle;
      content = newPostContent;
      category = newPostCategory;
      isAnonymous = false; // default for forum modal
    } else {
      title = titleOrEvent || "";
      content = contentParam || "";
      category = categoryParam || "GENERAL";
      isAnonymous = !!isAnonymousParam;
    }

    if (!title.trim() || !content.trim()) {
      toast.error(isAr ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in all fields');
      return false;
    }
    try {
      setPostSubmitting(true);
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/exchange/posts`, {
        title: title.trim(),
        content: content.trim(),
        category: category,
        isAnonymous: isAnonymous
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم النشر بنجاح!' : 'Posted successfully!');
        setNewPostTitle('');
        setNewPostContent('');
        setNewPostCategory('GENERAL');
        setIsNewPostModalOpen(false);
        fetchPosts();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error creating post:', err);
      toast.error(isAr ? 'فشل نشر الموضوع' : 'Failed to create discussion');
      return false;
    } finally {
      setPostSubmitting(false);
    }
  };

  const handleCreateComment = async (textOrEvent, isAnonymousParam) => {
    let content = "";
    let isAnonymous = false;

    if (textOrEvent && typeof textOrEvent.preventDefault === 'function') {
      textOrEvent.preventDefault();
      content = newCommentText;
      isAnonymous = false; // default for form
    } else {
      content = textOrEvent || "";
      isAnonymous = !!isAnonymousParam;
    }

    if (!content.trim() || !selectedPost) return false;
    try {
      setCommentSubmitting(true);
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/exchange/posts/${selectedPost.id}/comments`, {
        content: content.trim(),
        isAnonymous: isAnonymous
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        setNewCommentText('');
        toast.success(isAr ? 'تمت إضافة تعليقك' : 'Comment added!');
        fetchPostDetails(selectedPost.id);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error creating comment:', err);
      toast.error(isAr ? 'فشل إضافة التعليق' : 'Failed to add comment');
      return false;
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm(t('exchange.deletePostConfirm'))) return;
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.delete(`${API_URL}/api/exchange/posts/${postId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم حذف الموضوع بنجاح' : 'Discussion deleted successfully');
        if (selectedPost && selectedPost.id === postId) {
          setSelectedPost(null);
        }
        fetchPosts();
      }
    } catch (err) {
      console.error('Error deleting post:', err);
      toast.error(isAr ? 'فشل حذف الموضوع' : 'Failed to delete discussion');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm(t('exchange.deleteCommentConfirm'))) return;
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.delete(`${API_URL}/api/exchange/comments/${commentId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم حذف التعليق' : 'Comment deleted');
        if (selectedPost) {
          fetchPostDetails(selectedPost.id);
        }
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
      toast.error(isAr ? 'فشل حذف التعليق' : 'Failed to delete comment');
    }
  };

  useEffect(() => {
    if (activeTab === 'exchange') {
      fetchPosts();
    }
  }, [activeTab]);

  // تصفية الجداول وتجهيز المحاضرة التالية والنشطة حالياً
  const filteredSchedules = selectedGroupFilter === 'all'
    ? schedules
    : schedules.filter(s => s.groupId === parseInt(selectedGroupFilter));

  const getNextLecture = (items) => {
    if (!items || !items.length) return null;
    const now = new Date();
    const todayName = DAYS[now.getDay()];
    const curTime = now.toTimeString().substring(0, 5);
    
    const todayLeft = items.filter(s => getActiveDay(s) === todayName && getActiveStartTime(s) > curTime);
    if (todayLeft.length > 0) {
      return todayLeft.sort((a, b) => getActiveStartTime(a).localeCompare(getActiveStartTime(b)))[0];
    }
    
    let idx = (now.getDay() + 1) % 7;
    for (let i = 0; i < 7; i++) {
      const name = DAYS[idx];
      const lecs = items.filter(s => getActiveDay(s) === name);
      if (lecs.length > 0) {
        return lecs.sort((a, b) => getActiveStartTime(a).localeCompare(getActiveStartTime(b)))[0];
      }
      idx = (idx + 1) % 7;
    }
    return items[0];
  };

  const nextLecture = getNextLecture(filteredSchedules);

  useEffect(() => {
    if (!nextLecture) {
      setCountdown('');
      return;
    }
    const interval = setInterval(() => {
      setCountdown(getCountdownString(nextLecture, isAr));
    }, 1000);
    setCountdown(getCountdownString(nextLecture, isAr));
    return () => clearInterval(interval);
  }, [nextLecture, isAr]);

  const todayIndex = new Date().getDay();
  const todayName = DAYS[todayIndex];
  const todayLectures = filteredSchedules.filter(s => getActiveDay(s) === todayName);

  const getActiveLectureNow = () => {
    if (!schedules.length) return null;
    const now = new Date();
    const tName = DAYS[now.getDay()];
    const curTime = now.toTimeString().substring(0, 5);
    return schedules.find(s => {
      if (getActiveDay(s) !== tName) return false;
      const start = getActiveStartTime(s);
      const end = getActiveEndTime(s);
      return curTime >= start && curTime <= end;
    });
  };
  const activeLectureNow = getActiveLectureNow();

  const getMergedAlerts = () => {
    return notifications.map(n => ({
      id: n.id,
      message: n.message,
      type: n.groupId ? 'Urgent' : 'Academic',
      sentTime: n.sentTime
    }));
  };

  const allAlerts = getMergedAlerts();

  // ── إعدادات تفاصيل الرأس التفاعلي المتغير ──
  const getHeaderDetails = () => {
    if (activeTab === 'home') {
      const now = new Date();
      const hour = now.getHours();
      let greeting = isAr ? 'صباح الخير' : 'Good Morning';
      if (hour >= 12 && hour < 17) greeting = isAr ? 'طاب يومك' : 'Good Afternoon';
      else if (hour >= 17 && hour < 22) greeting = isAr ? 'مساء الخير' : 'Good Evening';
      else if (hour >= 22 || hour < 5) greeting = isAr ? 'مساء النور' : 'Good Night';
      
      const firstName = profile.name?.split(' ')[0] || (isAr ? 'الطالب' : 'Student');

      return {
        title: isAr ? `${greeting}، ${firstName}` : `${greeting}, ${firstName}`,
        subtitle: isAr ? 'كيف حالك اليوم؟ نأمل أن تكون مستعداً لمحاضراتك!' : "How are you today? We hope you're ready for lectures!",
        showAvatar: true
      };
    }
    if (activeTab === 'schedule') {
      return {
        title: isAr ? 'الجدول الأكاديمي' : 'Academic Calendar',
        subtitle: isAr ? 'تصفح جدول محاضراتك الأسبوعي' : 'Weekly timetable timeline',
        showAvatar: false
      };
    }
    if (activeTab === 'goals') {
      return {
        title: isAr ? 'التكاليف والمهام الأكاديمية' : 'Tasks & Academic Goals',
        subtitle: isAr ? 'تتبع التكاليف، المشاريع، ومواعيد الاختبارات والإنجازات' : 'Track assignments, exams, and cohort milestones',
        showAvatar: false
      };
    }
    if (activeTab === 'exams') {
      return {
        title: isAr ? 'جدول الامتحانات' : 'Exam Schedule',
        subtitle: isAr ? 'مواعيد وقاعات الاختبارات النهائية والجزئية' : 'Dates & exam halls',
        showAvatar: false
      };
    }
    if (activeTab === 'alerts') {
      return {
        title: isAr ? 'مركز التنبيهات' : 'Notification Hub',
        subtitle: isAr ? 'آخر تحديثات الكلية والإشعارات' : 'Important college notices & updates',
        showAvatar: false
      };
    }
    if (activeTab === 'exchange') {
      return {
        title: isAr ? 'ملتقى الشعبة' : 'Class Hub',
        subtitle: isAr ? 'تواصل وتفاعل مع زملائك في شعبتك' : 'Connect and discuss with classmates',
        showAvatar: false
      };
    }
    if (activeTab === 'profile') {
      return {
        title: isAr ? 'الهوية الرقمية' : 'Digital Identity',
        subtitle: isAr ? 'معرف الطالب وإعدادات الجلسة' : 'Student credentials & preferences',
        showAvatar: false
      };
    }
    if (activeTab === 'representative') {
      return {
        title: isAr ? 'بوابة المندوب' : 'Representative Panel',
        subtitle: isAr ? 'توزيع وتعديل الجداول للدفعة الأكاديمية' : 'Manage cohort schedules and distribution',
        showAvatar: false
      };
    }
    return { title: 'Portal', subtitle: '', showAvatar: false };
  };

  const header = getHeaderDetails();

  // ── المخطط البصري الأساسي والتصاميم ──
  return (
    <div className="flex-1 w-full flex items-center justify-center min-h-screen p-0 bg-[#070b13]" dir={isAr ? 'rtl' : 'ltr'}>
      <div
        className="w-full max-w-[430px] h-[100dvh] flex flex-col relative pb-[76px] shadow-2xl border-x border-white/5 overflow-hidden bg-[#0b1120]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* مؤشر التحديث بالسحب */}
        {pullDistance > 0 && (
          <div
            className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center bg-[var(--accent-dim)] text-[var(--accent)] text-[10px] font-black uppercase tracking-wider transition-all"
            style={{ height: `${Math.min(pullDistance, PULL_THRESHOLD)}px`, opacity: pullDistance / PULL_THRESHOLD }}
          >
            <span>{isAr ? '↓ اسحب للتحديث' : '↓ Pull to refresh'}</span>
          </div>
        )}
        
        {/* رأس الصفحة الديناميكي الثابت */}
        <header className="bg-[var(--bg-card)]/85 backdrop-blur-md h-16 flex items-center justify-between px-5 absolute top-0 w-full z-40 border-b border-[var(--border-color)] shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            {header.showAvatar && (
              <div className="w-9 h-9 rounded-xl border border-[var(--accent)]/50 bg-[var(--bg-card)] flex items-center justify-center font-black text-xs text-[var(--accent)] shadow-[0_0_12px_var(--accent-glow)] shrink-0">
                {profile.name ? profile.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-xs font-black text-white truncate leading-tight">
                {header.title}
              </h2>
              <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                {header.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleManualSync}
              className="p-2 border border-[var(--border-color)] hover:border-[var(--accent)] rounded-xl shrink-0 flex items-center justify-center transition-colors active:scale-95 bg-[var(--bg-card)]/40"
              title={isAr ? 'تحديث التطبيق والبيانات' : 'Update App & Data'}
            >
              <i className="ph ph-arrows-clockwise text-slate-400 hover:text-[var(--accent)] text-sm"></i>
            </button>
            <button
              onClick={() => i18n.changeLanguage(isAr ? 'en' : 'ar')}
              className="px-2.5 py-1.5 text-[9px] font-black uppercase border border-[var(--border-color)] hover:border-[var(--accent)] bg-[var(--bg-card)]/40 rounded-xl shrink-0 transition-colors active:scale-95 text-[var(--text-primary)]"
            >
              {isAr ? 'EN' : 'عربي'}
            </button>
            <ThemeSwitcher />
          </div>
        </header>

        {/* لوحة عرض المحتوى */}
        <main className="flex-1 overflow-y-auto pb-24 pt-20 px-4 space-y-6">
          
          {/* تنبيه وجود محاضرة نشطة الآن وإمكانية التحضير السريع */}
          {activeTab === 'home' && activeLectureNow && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-2xl border border-emerald-500/35 bg-emerald-950/15 backdrop-blur-md p-4 flex justify-between items-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.12)] w-full"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl animate-bounce shrink-0">📸</span>
                <div>
                  <h4 className="text-xs font-black text-emerald-400">
                    {isAr ? 'محاضرة نشطة الآن!' : 'Active Lecture Now!'}
                  </h4>
                  <p className="text-[10px] text-slate-300 font-bold mt-0.5 truncate">
                    {activeLectureNow.subject?.name} ({(activeLectureNow.overrides?.[0]?.newRoom?.name || activeLectureNow.room?.name) || 'N/A'})
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* تبديل التبويبات والمحتويات البرمجية */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="space-y-4"
              >
                {/* 1. تبويب الصفحة الرئيسية */}
                {activeTab === 'home' && (
                  <HomeTab
                    isAr={isAr}
                    profile={profile}
                    todayLectures={todayLectures}
                    attendanceStats={attendanceStats}
                    subjectStats={subjectStats}
                    countdownDisplay={countdown}
                    countdownSubText={isAr ? 'حتى المحاضرة القادمة' : 'until next lecture'}
                    schedules={schedules}
                    activeLectureNow={activeLectureNow}
                    sandboxMode={sandboxMode}
                    toggleSandbox={toggleSandbox}
                    isInstallable={isInstallable}
                    installApp={installApp}
                    allAlerts={allAlerts}
                    navigate={navigate}
                    setProfileViewMode={setProfileViewMode}
                    setActiveTab={setActiveTab}
                    handleManualSync={handleManualSync}
                    goalReminders={goalReminders}
                  />
                )}

                {/* 2. تبويب الجداول والمقررات */}
                {activeTab === 'schedule' && (
                  systemSettings.disableSchedules ? (
                    <UnderDevelopmentView isAr={isAr} featureNameAr="جداول المحاضرات" featureNameEn="Timetables" />
                  ) : (
                    <ScheduleTab
                      isAr={isAr}
                      schedules={schedules}
                      groups={groups}
                      sandboxMode={sandboxMode}
                      setActiveSimulatorSchedule={setActiveSimulatorSchedule}
                      setSimulatorDay={setSimulatorDay}
                      setSimulatorStart={setSimulatorStart}
                      setSimulatorEnd={setSimulatorEnd}
                      getActiveDay={getActiveDay}
                      getActiveStartTime={getActiveStartTime}
                      getActiveEndTime={getActiveEndTime}
                      goals={studentGoals}
                    />
                  )
                )}

                {/* 2.5 تبويب التكاليف والمهام الأكاديمية */}
                {activeTab === 'goals' && (
                  <GoalsTab
                    isAr={isAr}
                    goals={studentGoals}
                    goalsLoading={studentGoalsLoading}
                    onToggleGoal={handleToggleGoal}
                    onAddPersonalTask={handleAddPersonalTask}
                    onDeletePersonalTask={handleDeletePersonalTask}
                    profile={profile}
                    setProfile={setProfile}
                  />
                )}

                {/* 3. تبويب جدول الامتحانات */}
                {activeTab === 'exams' && (
                  systemSettings.disableExams ? (
                    <UnderDevelopmentView isAr={isAr} featureNameAr="جداول الامتحانات" featureNameEn="Exams Timetable" />
                  ) : (
                    <div className="frosted-panel rounded-3xl p-6 border border-white/5 bg-white/2 text-center space-y-4" style={{ background: 'var(--bg-card, #121824)', border: '1px solid var(--border-card, rgba(255,255,255,0.05))' }}>
                      <span className="text-3xl">📝</span>
                      <h3 className="text-sm font-black text-white">{isAr ? 'جدول الامتحانات الرسمية' : 'Official Exams Timetable'}</h3>
                      <p className="text-xs text-slate-450 leading-relaxed font-bold">
                        {isAr 
                          ? 'الامتحانات النهائية والجزئية تبدأ قريباً. سيتم نشر الجداول بالتفصيل هنا فور اعتمادها من الكلية.' 
                          : 'Final and midterm exams are starting soon. Detailed schedules will be published here once approved.'}
                      </p>
                    </div>
                  )
                )}

                {/* 5. تبويب الملف الشخصي والهوية الرقمية */}
                {activeTab === 'profile' && (
                  <ProfileTab
                    isAr={isAr}
                    profile={profile}
                    setProfile={setProfile}
                    systemSettings={systemSettings}
                    sandboxMode={sandboxMode}
                    toggleSandboxFromButton={toggleSandboxFromButton}
                    handleTestNotification={handleTestNotification}
                    handleCheckUpdates={handleCheckUpdates}
                    handleExportICS={handleExportICS}
                    handlePrintPDF={handlePrintPDF}
                    handleShareSchedule={handleShareSchedule}
                    confirmLogout={confirmLogout}
                    allAlerts={allAlerts}
                    fetchData={fetchData}
                    t={t}
                  />
                )}

                {/* 6. تبويب ملتقى الشعبة والنقاشات الأكاديمية */}
                {activeTab === 'exchange' && (
                  <ExchangeHubTab
                    isAr={isAr}
                    profile={profile}
                    posts={posts}
                    postsLoading={postsLoading}
                    selectedPost={selectedPost}
                    setSelectedPost={setSelectedPost}
                    postSubmitting={postSubmitting}
                    commentSubmitting={commentSubmitting}
                    handleCreatePost={handleCreatePost}
                    handleCreateComment={handleCreateComment}
                    handleDeletePost={handleDeletePost}
                    handleDeleteComment={handleDeleteComment}
                    fetchPostDetails={fetchPostDetails}
                    t={t}
                  />
                )}

                {/* 7. تبويب المندوب الخاص */}
                {activeTab === 'representative' && (
                  <DelegateTab
                    isAr={isAr}
                    profile={profile}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        {/* شريط الملاحة والتنقل السفلي */}
        <nav className="absolute bottom-0 left-0 w-full backdrop-blur-xl bg-[var(--bg-card)]/90 border-t border-[var(--border-color)] h-[72px] px-2 pb-2 pt-1 flex justify-between items-center rounded-t-3xl z-40 shadow-[0_-5px_15px_rgba(0,0,0,0.15)]">
          {[
            {
              id: 'home',
              label: isAr ? 'الرئيسية' : 'Home',
              iconActive: 'ph-fill ph-house',
              iconInactive: 'ph ph-house'
            },
            {
              id: 'schedule',
              label: isAr ? 'المقررات' : 'Courses',
              iconActive: 'ph-fill ph-book-open',
              iconInactive: 'ph ph-book-open'
            },
            {
              id: 'goals',
              label: isAr ? 'المهام' : 'Tasks',
              iconActive: 'ph-fill ph-checks',
              iconInactive: 'ph ph-checks'
            },
            {
              id: 'representative',
              label: isAr ? 'المندوب' : 'Delegate',
              iconActive: 'ph-fill ph-users-three',
              iconInactive: 'ph ph-users-three'
            },
            {
              id: 'exchange',
              label: isAr ? 'الملتقى' : 'Forum',
              iconActive: 'ph-fill ph-chats',
              iconInactive: 'ph ph-chats'
            },
            {
              id: 'profile',
              label: isAr ? 'الملف' : 'Profile',
              iconActive: 'ph-fill ph-user',
              iconInactive: 'ph ph-user'
            }
          ].map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center py-1 transition-all duration-200 active:scale-95 ${
                  active ? 'text-[#f59e0b]' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="relative flex flex-col items-center justify-center">
                  <i className={`${active ? tab.iconActive : tab.iconInactive} text-xl transition-all duration-200 ${
                    active ? 'drop-shadow-[0_0_8px_rgba(245,158,11,0.65)] scale-110' : ''
                  }`} />
                  <span className="text-[9px] font-bold mt-1 font-sans">{tab.label}</span>
                  {active && (
                    <span className="absolute -bottom-2 w-1.5 h-1.5 bg-[#f59e0b] rounded-full shadow-[0_0_6px_#f59e0b]" />
                  )}
                </div>
              </button>
            );
          })}
        </nav>

      </div>

      {/* ── لوحة محاكاة استثناء الحصة في وضع الاختبار السريع ── */}
      <AnimatePresence>
        {activeSimulatorSchedule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="frosted-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-5 text-white bg-slate-900 border border-slate-800"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                  🧪 {isAr ? 'محاكي تعديل الحصة' : 'Reschedule Simulator'}
                </h3>
                <button
                  onClick={() => setActiveSimulatorSchedule(null)}
                  className="text-slate-400 hover:text-white transition-colors text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-xs text-slate-350 font-bold">
                {isAr ? 'المحاضرة المحددة:' : 'Selected Lecture:'}{' '}
                <span className="text-white font-black">{activeSimulatorSchedule.subject.name}</span>
              </div>

              <form onSubmit={handleSimulateReschedule} className="space-y-4 text-xs font-bold">
                <div className="space-y-1">
                  <label className="text-slate-400 block">{isAr ? 'اليوم الدراسي' : 'Day'}</label>
                  <select
                    value={simulatorDay}
                    onChange={e => setSimulatorDay(e.target.value)}
                    className="w-full p-3 font-black bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {DAYS.map(day => (
                      <option key={day} value={day} className="bg-slate-950 text-white">
                        {isAr ? ({SUNDAY:'الأحد',MONDAY:'الاثنين',TUESDAY:'الثلاثاء',WEDNESDAY:'الأربعاء',THURSDAY:'الخميس',FRIDAY:'الجمعة',SATURDAY:'السبت'}[day]) : day}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-400 block">{isAr ? 'وقت البدء' : 'Start Time'}</label>
                    <input
                      type="time"
                      required
                      value={simulatorStart}
                      onChange={e => setSimulatorStart(e.target.value)}
                      className="w-full p-3 font-bold bg-slate-950 border border-slate-800 rounded-lg text-white"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400 block">{isAr ? 'وقت الانتهاء' : 'End Time'}</label>
                    <input
                      type="time"
                      required
                      value={simulatorEnd}
                      onChange={e => setSimulatorEnd(e.target.value)}
                      className="w-full p-3 font-bold bg-slate-950 border border-slate-800 rounded-lg text-white"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveSimulatorSchedule(null)}
                    className="btn-ghost px-4 py-2 text-xs font-bold rounded-lg hover:bg-slate-850"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-black rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
                  >
                    ⚡ {isAr ? 'تطبيق محاكاة' : 'Apply Simulation'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* نافذة تأكيد تسجيل الخروج */}
      <ConfirmationModal
        isOpen={isLogoutModalOpen}
        title={isAr ? 'تأكيد الخروج' : 'Confirm Sign Out'}
        message={isAr ? 'هل أنت متأكد من الخروج من بوابة الطالب؟' : 'Are you sure you want to sign out of the student portal?'}
        onConfirm={confirmLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
        confirmText={isAr ? 'خروج' : 'Sign Out'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
      />

      {/* حقن حركات الرسوم البصرية الفاخرة للـ Marquee والنبض */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 16s linear infinite;
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.45); }
          70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .pulse-ring-emerald {
          animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse-ring-accent {
          0% { box-shadow: 0 0 0 0 var(--accent-glow); }
          70% { box-shadow: 0 0 0 8px rgba(255,255,255,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
        }
        .pulse-ring-active {
          animation: pulse-ring-accent 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      ` }} />
    </div>
  );
}
