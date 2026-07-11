import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// Check if running on native platform (Android/iOS)
export const isNative = () => {
  return Capacitor.isNativePlatform();
};

// ─────────────────────────────────────────────────────────────────────────────
// Permission Requests
// ─────────────────────────────────────────────────────────────────────────────

// Request permissions for local notifications (native + web)
export const requestLocalNotificationPermission = async () => {
  if (isNative()) {
    try {
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        const reqStatus = await LocalNotifications.requestPermissions();
        return reqStatus.display === 'granted';
      }
      return true;
    } catch (err) {
      console.error('[Local Notifications] Native permission request error:', err);
      return false;
    }
  }

  // Web / PWA path — use browser Notification API
  if ('Notification' in window) {
    try {
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (err) {
      console.error('[Web Notifications] Permission request error:', err);
      return false;
    }
  }

  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// Native: Clear all scheduled notifications
// ─────────────────────────────────────────────────────────────────────────────
export const clearAllLocalNotifications = async () => {
  if (isNative()) {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications && pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map(n => ({ id: n.id }))
        });
        console.log(`[Local Notifications] Cancelled ${pending.notifications.length} pending notification(s).`);
      }
    } catch (err) {
      console.error('[Local Notifications] Error clearing notifications:', err);
    }
  }
  // Web: SW alarm handles are cleared on next SCHEDULE_CACHE_UPDATE message
};

// ─────────────────────────────────────────────────────────────────────────────
// Web / PWA: Post schedule to Service Worker alarm engine
// The SW will schedule local notifications using setTimeout — works offline.
// ─────────────────────────────────────────────────────────────────────────────
async function postScheduleToServiceWorker(schedules, settings) {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if (!reg || !reg.active) {
      console.warn('[SW Bridge] No active service worker found.');
      return;
    }
    reg.active.postMessage({
      type: 'SCHEDULE_CACHE_UPDATE',
      schedules,
      settings
    });
    console.log('[SW Bridge] Schedule dispatched to SW alarm engine:', schedules.length, 'lectures');
  } catch (err) {
    console.warn('[SW Bridge] Failed to post schedule to SW:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export: Schedule offline notifications for the next 7 days
// Works on BOTH native Capacitor (Android) AND web/PWA (via SW alarm engine)
// ─────────────────────────────────────────────────────────────────────────────
export const scheduleOfflineNotifications = async (schedules, isAr = false) => {
  // ── Read user alert settings ──────────────────────────────────────────────
  let preAlertMins = 15; // Default: 15 minutes
  let preAlertTimeStr = '15';
  let pushEnabled = true;
  try {
    const savedToggles = localStorage.getItem('student_alert_toggles');
    if (savedToggles) {
      const toggles = JSON.parse(savedToggles);
      preAlertTimeStr = toggles.preAlertTime || '15';
      preAlertMins = parseInt(preAlertTimeStr, 10);
      pushEnabled = toggles.push !== false;
    }
  } catch (e) {
    console.warn('[Local Notifications] Error reading preAlertTime:', e);
  }

  const settings = {
    preAlertTime: preAlertTimeStr,
    language: isAr ? 'ar' : 'en',
    push: pushEnabled
  };

  // If push notifications are disabled, clear all native + SW alarms and stop
  if (!pushEnabled) {
    console.log('[Local Notifications] Notifications disabled by user settings. Clearing alarms...');
    await clearAllLocalNotifications();
    await postScheduleToServiceWorker([], settings);
    return;
  }

  // ── Request permission first ──────────────────────────────────────────────
  const hasPermission = await requestLocalNotificationPermission();
  if (!hasPermission) {
    console.warn('[Local Notifications] Permission denied — notifications blocked.');
    return;
  }

  if (!schedules || schedules.length === 0) {
    console.log('[Local Notifications] No schedules provided — skipping alarm scheduling.');
    return;
  }

  // Helper to compare dates ignoring hours/minutes/seconds
  const isSameDate = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  // ── NATIVE PATH (Capacitor — Android / iOS) ───────────────────────────────
  if (isNative()) {
    try {
      await clearAllLocalNotifications();

      const notificationsToSchedule = [];
      const now = new Date();
      const DAYS_ENUM = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      let notificationIdCounter = 1;

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const targetDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const targetDayName = DAYS_ENUM[targetDate.getDay()];

        // Morning greeting at 8:00 AM
        const morningTime = new Date(targetDate);
        morningTime.setHours(8, 0, 0, 0);
        if (morningTime > now && notificationIdCounter <= 60) {
          notificationsToSchedule.push({
            id: notificationIdCounter++,
            title: isAr ? 'صباح الخير ☀️' : 'Good Morning ☀️',
            body: isAr
              ? 'صباح الخير! نتمنى لك يوماً دراسياً موفقاً. لا تنسَ التحقق من جدول محاضراتك لليوم.'
              : "Good morning! Wishing you a successful academic day. Don't forget to check your schedule.",
            schedule: { at: morningTime },
            extra: { url: '/student/home' }
          });
        }

        // Afternoon check-in at 3:00 PM
        const afternoonTime = new Date(targetDate);
        afternoonTime.setHours(15, 0, 0, 0);
        if (afternoonTime > now && notificationIdCounter <= 60) {
          notificationsToSchedule.push({
            id: notificationIdCounter++,
            title: isAr ? 'كيف كانت محاضراتك اليوم؟ 🤔' : 'How were your lectures today? 🤔',
            body: isAr
              ? 'مساء الخير! كيف كانت محاضراتك اليوم؟ نتمنى أنك استمتعت واستفدت.'
              : 'Good afternoon! How were your lectures today? We hope you enjoyed and benefited.',
            schedule: { at: afternoonTime },
            extra: { url: '/student/home' }
          });
        }

        // Schedule summary at 8:00 PM
        const summaryTime = new Date(targetDate);
        summaryTime.setHours(20, 0, 0, 0);
        if (summaryTime > now && notificationIdCounter <= 60) {
          notificationsToSchedule.push({
            id: notificationIdCounter++,
            title: isAr ? 'ملخص جدول الغد 📋' : "Tomorrow's Schedule Summary 📋",
            body: isAr
              ? 'انقر لمشاهدة ملخص جدول المحاضرات والتعديلات المجدولة ليوم غد.'
              : "Click to view tomorrow's lecture timetable and any scheduled updates.",
            schedule: { at: summaryTime },
            extra: { url: '/student/home' }
          });
        }

        // Pre-lecture reminders (Dynamic checks matching targetDate)
        for (const lec of schedules) {
          if (notificationIdCounter > 60) break;

          const specificOverride = lec.overrides?.find(o => isSameDate(new Date(o.date), targetDate));

          let activeStartTime = null;
          let roomName = '';

          if (specificOverride) {
            // If the lecture is cancelled on this specific date, skip it
            if (specificOverride.newStartTime === null) {
              continue;
            }
            activeStartTime = specificOverride.newStartTime || lec.startTime;
            roomName = specificOverride.newRoom?.name || (lec.room?.name || '');
          } else {
            // Normal schedule day check
            if (lec.dayOfWeek !== targetDayName) {
              continue;
            }
            activeStartTime = lec.startTime;
            roomName = lec.room?.name || '';
          }

          const [hours, minutes] = activeStartTime.split(':').map(Number);
          const lecStartTime = new Date(targetDate);
          lecStartTime.setHours(hours, minutes, 0, 0);
          const triggerTime = new Date(lecStartTime.getTime() - preAlertMins * 60 * 1000);

          if (triggerTime > now) {
            const subjectName = lec.subject?.name || 'محاضرة';

            notificationsToSchedule.push({
              id: notificationIdCounter++,
              title: isAr ? 'تذكير بمحاضرة ⏰' : 'Lecture Reminder ⏰',
              body: isAr
                ? `تبدأ محاضرة ${subjectName} بعد ${preAlertMins} دقيقة${roomName ? ' في قاعة ' + roomName : ''}.`
                : `${subjectName} starts in ${preAlertMins} minutes${roomName ? ' — Room ' + roomName : ''}.`,
              schedule: { at: triggerTime },
              extra: { url: '/student/home' }
            });
          }
        }
      }

      if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: notificationsToSchedule });
        console.log(`[Local Notifications] Scheduled ${notificationsToSchedule.length} native alarms.`);
      } else {
        console.log('[Local Notifications] No upcoming events in the next 7 days.');
      }
    } catch (err) {
      console.error('[Local Notifications] Error scheduling native alarms:', err);
    }
    return;
  }

  // ── WEB / PWA PATH (Chrome, Safari, Firefox) ─────────────────────────────
  // Delegate all alarm scheduling to the Service Worker which survives
  // tab closure and works offline via its own setTimeout engine.
  console.log('[Local Notifications] Web/PWA mode — delegating alarm scheduling to Service Worker...');
  await postScheduleToServiceWorker(schedules, settings);
};
