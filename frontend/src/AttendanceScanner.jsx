import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from './config';

export default function AttendanceScanner() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [coords, setCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [bypassGPS, setBypassGPS] = useState(false);
  const [disableAttendance, setDisableAttendance] = useState(false);

  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { success: boolean, message: string, data: any }

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/auth/system/settings`);
        if (res.data?.success && res.data.settings?.disableAttendance) {
          setDisableAttendance(true);
        }
      } catch (err) {
        console.error('Failed to fetch system settings', err);
      }
    };
    fetchSettings();
  }, []);

  // 1. Fetch Location Coordinates
  const requestGPSLocation = async () => {
    setGpsLoading(true);
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError(isAr ? 'المتصفح لا يدعم تحديد الموقع الجغرافي' : 'Geolocation is not supported by your browser');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setGpsLoading(false);
      },
      (error) => {
        console.warn('GPS Error:', error);
        let errorMsg = isAr ? 'فشل الحصول على موقعك. يرجى تفعيل الـ GPS.' : 'Failed to obtain GPS coordinates. Please enable location services.';
        if (error.code === 1) {
          errorMsg = isAr ? 'تم رفض إذن تحديد الموقع. يمكنك استخدام خيار التجاوز للتجربة.' : 'Permission denied. You can use the bypass option for testing.';
        }
        setGpsError(errorMsg);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    requestGPSLocation();
  }, []);

  // 2. Fetch student's schedules to match current time
  useEffect(() => {
    const fetchSchedules = async () => {
      const token = localStorage.getItem('manar_token');
      const userJson = localStorage.getItem('manar_user');
      if (!token || !userJson) return;
      try {
        const u = JSON.parse(userJson);
        const url = u.majorId && u.levelId
          ? `${API_URL}/api/schedules?majorId=${u.majorId}&levelId=${u.levelId}`
          : `${API_URL}/api/schedules?groupId=${u.groupId || 1}`;
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data?.success) {
          const list = res.data.data;
          setSchedules(list);
          
          // Match active class for today
          const now = new Date();
          const DAYS_MAP = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
          const todayDay = DAYS_MAP[now.getDay()];
          
          const todayScheds = list.filter(s => s.dayOfWeek === todayDay);
          const nowTotal = now.getHours() * 60 + now.getMinutes();
          
          let active = todayScheds.find(s => {
            const [sh, sm] = s.startTime.split(':').map(Number);
            const [eh, em] = s.endTime.split(':').map(Number);
            const startT = sh * 60 + sm;
            const endT = eh * 60 + em;
            return nowTotal >= startT - 30 && nowTotal <= endT + 30;
          });
          
          if (!active && todayScheds.length > 0) {
            active = todayScheds[0];
          }
          
          if (active) {
            setSelectedScheduleId(active.id.toString());
          } else if (list.length > 0) {
            setSelectedScheduleId(list[0].id.toString());
          }
        }
      } catch (err) {
        console.error('Failed to fetch student schedules', err);
      }
    };
    fetchSchedules();
  }, []);

  // 3. Submit check-in to backend GPS endpoint
  const handleCheckIn = async () => {
    if (!selectedScheduleId) {
      toast.error(isAr ? 'الرجاء اختيار محاضرة أولاً' : 'Please select a lecture slot first');
      return;
    }

    setSubmitting(true);
    setScanResult(null);

    const payload = {
      scheduleId: parseInt(selectedScheduleId),
      bypassGPS,
      latitude: bypassGPS ? 15.35 : coords?.latitude,
      longitude: bypassGPS ? 44.20 : coords?.longitude
    };

    try {
      const jwtToken = localStorage.getItem('manar_token');
      const headers = jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {};

      const res = await axios.post(`${API_URL}/api/student/attendance/checkin`, payload, { headers });
      if (res.data?.success) {
        setScanResult({
          success: true,
          message: res.data.message,
          data: res.data.data
        });
        toast.success(res.data.message);
        
        // Dispatch global event for live stats updates
        window.dispatchEvent(new Event('MANAR_ATTENDANCE_MARKED'));
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || (isAr ? 'فشل تسجيل الحضور' : 'Failed to register attendance');
      setScanResult({
        success: false,
        message: errMsg
      });
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSchedule = schedules.find(s => s.id.toString() === selectedScheduleId);

  const translateDay = (day) => {
    const days = {
      SUNDAY: isAr ? 'الأحد' : 'Sunday',
      MONDAY: isAr ? 'الإثنين' : 'Monday',
      TUESDAY: isAr ? 'الثلاثاء' : 'Tuesday',
      WEDNESDAY: isAr ? 'الأربعاء' : 'Wednesday',
      THURSDAY: isAr ? 'الخميس' : 'Thursday',
      FRIDAY: isAr ? 'الجمعة' : 'Friday',
      SATURDAY: isAr ? 'السبت' : 'Saturday'
    };
    return days[day] || day;
  };

  if (disableAttendance) {
    return (
      <div className="p-4 space-y-6 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-[var(--accent-dim)] opacity-[0.2] rounded-full blur-[100px]" />
        
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="frosted-panel w-full max-w-sm rounded-3xl p-8 border border-white/5 bg-slate-900/60 text-center space-y-6 relative overflow-hidden"
          style={{ background: 'var(--bg-card, #121824)', border: '1px solid var(--border-card, rgba(255,255,255,0.05))' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-[var(--accent)]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="w-16 h-16 rounded-2xl bg-amber-550/10 border border-amber-500/20 flex items-center justify-center text-3xl mx-auto shadow-inner">
            🚧
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-black text-white">
              {isAr ? 'تسجيل الحضور الذكي قيد التطوير' : 'Smart Attendance Under Development'}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed font-bold">
              {isAr
                ? 'ميزة تسجيل الحضور المباشر بالـ GPS معطلة مؤقتاً من قبل الإدارة لإجراء التحديثات والتعديلات.'
                : 'The GPS-based presence verification feature is temporarily disabled by the administration for upgrades.'}
            </p>
          </div>
          <div className="pt-2">
            <span className="inline-block px-3 py-1 rounded-full border border-amber-500/20 bg-amber-950/30 text-amber-400 text-[10px] font-black uppercase tracking-wider font-mono">
              ● Under Maintenance / قيد الصيانة
            </span>
          </div>
          <div className="pt-4 border-t border-white/5 w-full text-center">
            <button
              onClick={() => navigate('/student/home')}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-xs font-bold text-white rounded-xl transition-all"
            >
              {isAr ? 'العودة للرئيسية' : 'Back to Home'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 flex flex-col items-center justify-center min-h-[80vh]">
      
      {/* Background glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-[var(--accent-dim)] opacity-[0.2] rounded-full blur-[100px]" />

      <div className="w-full max-w-sm space-y-5 text-center">
        
        {/* Banner Greeting */}
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] bg-[var(--accent-dim)] border border-[var(--accent-glow)] px-2.5 py-1 rounded-md">
            📍 {isAr ? 'تحضير الـ GPS المباشر' : 'GPS ATTENDANCE CHECK-IN'}
          </span>
          <h2 className="text-lg font-black text-white mt-3">
            {isAr ? 'تسجيل الحضور التلقائي' : 'Instant GPS Attendance'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isAr ? 'يجب أن تتواجد داخل مبنى الكلية لتسجيل حضورك الفوري' : 'Confirm your location inside the campus to register'}
          </p>
        </div>

        {/* GPS location status card */}
        <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-2xl text-xs text-left flex flex-col gap-2 shadow-md">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-white flex items-center gap-1.5">
              🛰️ {isAr ? 'الموقع الجغرافي (GPS):' : 'GPS Satellite Status:'}
            </span>
            {gpsLoading ? (
              <span className="text-[10px] text-amber-400 font-bold animate-pulse">{isAr ? 'تحديد الإحداثيات...' : 'Locating...'}</span>
            ) : coords ? (
              <span className="text-[10px] text-[var(--accent)] font-bold">● {isAr ? 'متصل ومحدّد' : 'Locked'}</span>
            ) : (
              <span className="text-[10px] text-red-400 font-bold">● {isAr ? 'غير متوفر' : 'Unavailable'}</span>
            )}
          </div>

          {coords && (
            <p className="text-[10px] text-slate-400 font-semibold font-mono">
              Lat: {coords.latitude.toFixed(5)}, Lon: {coords.longitude.toFixed(5)}
            </p>
          )}

          {gpsError && !bypassGPS && (
            <p className="text-[10px] text-red-400 font-bold bg-red-500/5 p-2 rounded-lg border border-red-500/10">
              ⚠️ {gpsError}
            </p>
          )}

          {/* Test Bypass checkbox */}
          <label className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={bypassGPS}
              onChange={(e) => setBypassGPS(e.target.checked)}
              className="accent-[var(--accent)] h-3.5 w-3.5 rounded border-white/10 bg-black"
            />
            <span className="text-[10px] text-[var(--accent)] font-black uppercase tracking-wider">
              {isAr ? 'تجاوز فحص الـ GPS (للتجربة والعرض)' : 'Bypass GPS checking (for demo)'}
            </span>
          </label>
        </div>

        {/* Action Panel: Loading, Result, or Active Class Checkin */}
        <div className="bg-slate-950/40 border border-slate-850 rounded-3xl p-5 relative overflow-hidden min-h-[260px] flex flex-col justify-center shadow-lg">
          
          <AnimatePresence mode="wait">
            {submitting && (
              <motion.div
                key="submitting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 gap-3"
              >
                <span className="h-9 w-9 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  {isAr ? 'جاري التحقق الجغرافي وتسجيل حضورك...' : 'Verifying coordinates & checking-in...'}
                </p>
              </motion.div>
            )}

            {!submitting && scanResult && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center py-6 space-y-4"
              >
                <span className={`text-5xl p-4 rounded-full ${scanResult.success ? 'bg-[var(--accent-dim)] text-[var(--accent)]' : 'bg-red-500/10 text-red-400'}`}>
                  {scanResult.success ? '🎉' : '❌'}
                </span>
                <div>
                  <h3 className={`font-black text-base ${scanResult.success ? 'text-[var(--accent)]' : 'text-red-400'}`}>
                    {scanResult.success ? (isAr ? 'تم تسجيل حضورك!' : 'Checked In!') : (isAr ? 'فشل تسجيل الحضور' : 'Check-in Failed')}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 font-bold px-3 leading-relaxed">
                    {scanResult.message}
                  </p>
                </div>

                {scanResult.success && scanResult.data && (
                  <div className="bg-white/3 border border-white/5 rounded-xl px-4 py-2 text-[10px] font-bold text-slate-400 space-y-1">
                    <p>{isAr ? 'المادة:' : 'Class:'} <span className="text-white font-extrabold">{selectedSchedule?.subject?.name}</span></p>
                    <p>{isAr ? 'الحالة:' : 'Status:'} <span className="text-white font-extrabold uppercase">{scanResult.data.status}</span></p>
                    <p>{isAr ? 'الوقت:' : 'Time:'} <span className="text-white font-mono">{new Date(scanResult.data.scannedAt).toLocaleTimeString()}</span></p>
                  </div>
                )}

                <div className="flex gap-2 w-full pt-4">
                  <button
                    onClick={() => navigate('/student/home')}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-xs font-bold text-white rounded-xl transition-all"
                  >
                    {isAr ? 'الرئيسية' : 'Home'}
                  </button>
                  <button
                    onClick={() => setScanResult(null)}
                    className="flex-1 py-2.5 bg-[var(--accent)] hover:opacity-90 text-xs font-black text-black rounded-xl transition-all"
                  >
                    {isAr ? 'رجوع' : 'Back'}
                  </button>
                </div>
              </motion.div>
            )}

            {!submitting && !scanResult && (
              <motion.div key="selector" className="space-y-4 text-left">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    {isAr ? 'اختر المحاضرة النشطة حالياً:' : 'Select Current Active Lecture:'}
                  </label>
                  {schedules.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400 italic">
                      {isAr ? 'لا توجد محاضرات في جدولك.' : 'No lectures in your schedule.'}
                    </p>
                  ) : (
                    <select
                       value={selectedScheduleId}
                       onChange={(e) => setSelectedScheduleId(e.target.value)}
                       className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white cursor-pointer focus:outline-none focus:border-[var(--accent)]"
                    >
                      {schedules.map(s => (
                        <option key={s.id} value={s.id}>
                          {translateDay(s.dayOfWeek)}: {s.subject?.name} ({s.startTime} - {s.endTime})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedSchedule && (
                  <div className="bg-white/3 border border-white/5 rounded-2xl p-3.5 space-y-1 text-[11px] font-bold text-slate-400">
                    <p className="text-white text-xs font-extrabold">{selectedSchedule.subject?.name}</p>
                    <p>👨‍🏫 {selectedSchedule.lecturerName}</p>
                    <p>🏢 {selectedSchedule.room?.name || 'N/A'}</p>
                    <p>🕒 {selectedSchedule.startTime} - {selectedSchedule.endTime}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={!selectedScheduleId || (gpsLoading && !bypassGPS)}
                  className="w-full py-3.5 bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-slate-950 text-xs font-black rounded-xl uppercase tracking-wider transition-all shadow-[0_0_20px_var(--accent-glow)] active:scale-98 flex items-center justify-center gap-2"
                >
                  🚀 {isAr ? 'تسجيل حضوري الآن بالـ GPS' : 'Submit GPS Attendance'}
                </button>

                <div className="pt-2 border-t border-white/5 text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/student/home')}
                    className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-white"
                  >
                    {isAr ? 'إلغاء والعودة للرئيسية' : 'Cancel & Go Home'}
                  </button>
                </div>

              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>

    </div>
  );
}
