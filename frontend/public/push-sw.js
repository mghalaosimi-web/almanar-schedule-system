// ═══════════════════════════════════════════════════════════════════════════
// MANAR SMART SCHEDULE — UNIFIED SERVICE WORKER
// Handles: Server Push events + Offline Local Alarm Engine
// Fires pre-lecture notifications using cached schedule data — works in
// full airplane mode / 0 bytes of internet.
// ═══════════════════════════════════════════════════════════════════════════

const SW_SCHEDULE_CACHE_KEY = 'manar_sw_schedule_v1';
const SW_SETTINGS_CACHE_KEY = 'manar_sw_settings_v1';

// ── In-memory alarm registry (cleared on SW restart — rescheduled on next message) ──
let _alarmHandles = [];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: Receive schedule data from the main thread
// The StudentDashboard posts a message after every successful cache write.
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('message', function (event) {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'SCHEDULE_CACHE_UPDATE') {
    const schedules = data.schedules || [];
    const settings = data.settings || {};
    
    const updateCache = async () => {
      try {
        const cache = await caches.open(SW_SCHEDULE_CACHE_KEY);
        await cache.put('/schedules', new Response(JSON.stringify(schedules)));
        await cache.put('/settings', new Response(JSON.stringify(settings)));
        console.log('[SW] Cache storage updated successfully.');
      } catch (err) {
        console.warn('[SW] Cache storage save failed:', err);
      }
    };

    if (event.waitUntil) {
      event.waitUntil(updateCache());
    } else {
      updateCache();
    }
    
    console.log('[SW] Schedule cache received:', schedules.length, 'entries. Rescheduling local alarms...');
    rescheduleAllAlarms(schedules, settings);
  }

  if (data.type === 'CLEAR_ALARMS') {
    clearAllAlarms();
    const clearCache = async () => {
      try {
        const cache = await caches.open(SW_SCHEDULE_CACHE_KEY);
        await cache.delete('/schedules');
        await cache.delete('/settings');
      } catch (err) {}
    };
    if (event.waitUntil) {
      event.waitUntil(clearCache());
    } else {
      clearCache();
    }
    console.log('[SW] All alarms cleared by main thread.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: Server Push Events
// Handles server-pushed updates. If the flag is MANAR_SCHEDULE_UPDATE,
// it notifies the user and instructs the main thread to re-sync.
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('push', function (event) {
  console.log('[SW] Push event received.');
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'تنبيه جديد', body: event.data.text() };
    }
  }

  // If this is an administrative schedule mutation event — tell clients to sync
  if (data.type === 'MANAR_SCHEDULE_UPDATE' || data.flag === 'MANAR_SCHEDULE_UPDATE') {
    event.waitUntil(
      Promise.all([
        self.registration.showNotification(
          data.title || 'تم تحديث جدول المحاضرات 📅',
          {
            body: data.body || 'تم تعديل جدول محاضراتك. افتح التطبيق لرؤية التغييرات.',
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            vibrate: [100, 60, 100, 60, 200],
            tag: 'schedule-update',
            renotify: true,
            data: { url: '/student/home', forceSync: true }
          }
        ),
        // Broadcast to all open tabs to force a data refresh
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'FORCE_SCHEDULE_SYNC', reason: 'server_push' });
          });
        })
      ])
    );
    return;
  }

  // Generic push notification display
  const title = data.title || 'نظام جداول كلية المنار';
  const options = {
    body: data.body || 'لديك تحديث جديد في جدول المحاضرات.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/student/home' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: Notification Click Handler
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  console.log('[SW] Notification clicked:', event.notification.tag);
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/student/home';

  const shouldForceSync = event.notification.data && event.notification.data.forceSync;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          if (shouldForceSync) {
            client.postMessage({ type: 'FORCE_SCHEDULE_SYNC', reason: 'notification_click' });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: Offline Alarm Scheduling Engine
// Computes pre-lecture fire times for the next 7 days from the cached schedule
// catalog and registers them as setTimeout chains. Works with 0 internet.
// ─────────────────────────────────────────────────────────────────────────────

function clearAllAlarms() {
  _alarmHandles.forEach(handle => clearTimeout(handle));
  _alarmHandles = [];
}

function rescheduleAllAlarms(schedules, settings) {
  clearAllAlarms();
  if (!schedules || schedules.length === 0) return;

  // Check if push notifications are disabled in settings
  if (settings.push === false) {
    console.log('[SW] Push notifications are disabled in settings. Skipping reschedule.');
    return;
  }

  const preAlertMins = parseInt(settings.preAlertTime || '15', 10);
  const isAr = settings.language === 'ar';

  const DAYS_ENUM = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const now = new Date();
  let alarmCount = 0;
  const MAX_ALARMS = 64; // Cap to avoid memory bloat

  // Helper to compare dates ignoring hours/minutes/seconds
  const isSameDate = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const targetDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const targetDayName = DAYS_ENUM[targetDate.getDay()];

    for (const lec of schedules) {
      if (alarmCount >= MAX_ALARMS) break;

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

      const parts = activeStartTime.split(':');
      if (parts.length < 2) continue;
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (isNaN(hours) || isNaN(minutes)) continue;

      const lecStart = new Date(targetDate);
      lecStart.setHours(hours, minutes, 0, 0);

      const triggerTime = new Date(lecStart.getTime() - preAlertMins * 60 * 1000);
      const delay = triggerTime.getTime() - now.getTime();

      if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) {
        const subjectName = (lec.subject && lec.subject.name) ? lec.subject.name : 'محاضرة';
        const notifTitle = isAr ? 'تذكير بمحاضرة ⏰' : 'Lecture Reminder ⏰';
        const notifBody = isAr
          ? `تبدأ محاضرة ${subjectName} بعد ${preAlertMins} دقيقة${roomName ? ' في قاعة ' + roomName : ''}.`
          : `${subjectName} starts in ${preAlertMins} minutes${roomName ? ' — Room ' + roomName : ''}.`;

        const handle = setTimeout(() => {
          self.registration.showNotification(notifTitle, {
            body: notifBody,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            vibrate: [200, 100, 200],
            tag: `lecture-alarm-${lec.id || alarmCount}`,
            renotify: true,
            silent: false,
            data: { url: '/student/home' }
          }).catch(err => console.warn('[SW] Alarm notification failed:', err));
        }, delay);

        _alarmHandles.push(handle);
        alarmCount++;
        console.log(`[SW] Alarm #${alarmCount} scheduled: "${subjectName}" in ${Math.round(delay / 60000)} min`);
      }
    }
  }

  console.log(`[SW] Total alarms scheduled: ${alarmCount} (next 7 days, ${preAlertMins}-min pre-alert)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: Service Worker Cache Restoration on Startup
// ─────────────────────────────────────────────────────────────────────────────

const restoreAndSchedule = async () => {
  try {
    const cache = await caches.open(SW_SCHEDULE_CACHE_KEY);
    const schedRes = await cache.match('/schedules');
    const settRes = await cache.match('/settings');
    if (schedRes && settRes) {
      const schedules = await schedRes.json();
      const settings = await settRes.json();
      console.log('[SW] Restored schedules and settings from Cache Storage. Rescheduling alarms...', schedules.length, 'entries');
      rescheduleAllAlarms(schedules, settings);
    }
  } catch (err) {
    console.warn('[SW] Failed to restore from Cache Storage:', err);
  }
};

self.addEventListener('activate', function (event) {
  event.waitUntil(restoreAndSchedule());
});

// Run restoration top-level to schedule immediately when worker fires up
restoreAndSchedule();
