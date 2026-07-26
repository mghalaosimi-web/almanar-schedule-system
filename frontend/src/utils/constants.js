/**
 * @file constants.js
 * @description مرجع موحد لجميع الثوابت والمفاتيح المشتركة عبر واجهة ERP.
 * Single source-of-truth for all shared constants, roles, keys, and event names.
 * Import from here instead of hard-coding strings in each component.
 */

// ── Role Registry ─────────────────────────────────────────────────────────────
export const ROLES = Object.freeze({
  SUPER_ADMIN:   'SUPER_ADMIN',
  UNI_ADMIN:     'UNI_ADMIN',
  COLLEGE_ADMIN: 'COLLEGE_ADMIN',
  ADMIN:         'ADMIN',
  LECTURER:      'LECTURER',
  STUDENT:       'STUDENT',
});

// Developer email bypass list (centralised — was duplicated in 6 files)
export const DEVELOPER_EMAILS = Object.freeze([
  'developer@mghal.com',
  'm.gh.alosimi@gmail.com',
]);

/**
 * Returns true if the user has admin-level portal access.
 * @param {Object|null} user - Parsed user object from localStorage.
 */
export function hasAdminAccess(user) {
  if (!user) return false;
  if ([ROLES.SUPER_ADMIN, ROLES.UNI_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.ADMIN].includes(user.role)) return true;
  if (user.email && DEVELOPER_EMAILS.includes(user.email.toLowerCase())) return true;
  return false;
}

/**
 * Returns true if the user has developer / SUPER_ADMIN portal access.
 * @param {Object|null} user - Parsed user object from localStorage.
 */
export function isDeveloperAccess(user) {
  if (!user) return false;
  if (user.role === ROLES.SUPER_ADMIN) return true;
  if (user.email && DEVELOPER_EMAILS.includes(user.email.toLowerCase())) return true;
  return false;
}

// ── Session / LocalStorage Key Registry ──────────────────────────────────────
export const SESSION_KEYS = Object.freeze({
  TOKEN:                   'manar_token',
  USER:                    'manar_user',
  STUDENT_PROFILE:         'student_profile',
  ADMIN_UNLOCKED:          'manar_admin_unlocked',       // sessionStorage
  DEV_UNLOCKED:            'manar_dev_unlocked',         // sessionStorage
  IMPERSONATE_TOKEN:       'manar_super_admin_token',
  IMPERSONATE_USER:        'manar_super_admin_user',
  LANG:                    'manar_lang',
  THEME_MODE:              'manar_theme_mode',
  THEME_COLOR:             'selectedUniversityThemeColor',
  UNIVERSITY_LOGO:         'selectedUniversityLogo',
  UNIVERSITY_NAME:         'selectedUniversityName',
  UNIVERSITY_SLUG:         'selectedUniversitySlug',
  COLLEGE_NAME:            'selectedCollegeName',
  SANDBOX_MODE:            'manar_sandbox_mode',
  SANDBOX_SCHEDULES:       'manar_sandbox_schedules',
  ALERT_TOGGLES:           'student_alert_toggles',
  // Cached data keys
  CACHE_SCHEDULES:         'cached_student_schedules',
  CACHE_STATS:             'cached_student_stats',
  CACHE_SUBJECT_STATS:     'cached_student_subject_stats',
  CACHE_NOTIFICATIONS:     'cached_student_notifications',
  CACHE_SYSTEM_SETTINGS:   'cached_system_settings',
  CACHE_TS:                'cached_student_ts',
  // SUPER_ADMIN tenant context keys
  SA_COLLEGE_ID:           'superadmin_selectedCollegeId',
  SA_COLLEGE_NAME:         'superadmin_selectedCollegeName',
  SA_UNI_NAME:             'superadmin_selectedUniversityName',
  SA_UNI_LOGO:             'superadmin_selectedUniversityLogo',
  SA_UNI_SLUG:             'superadmin_selectedUniversitySlug',
  SA_THEME_COLOR:          'superadmin_selectedThemeColor',
});

// ── Custom Window Event Name Registry ────────────────────────────────────────
export const EVENTS = Object.freeze({
  SCHEDULE_UPDATED:        'MANAR_SCHEDULE_UPDATE',
  BROADCAST_RECEIVED:      'MANAR_BROADCAST_RECEIVE',
  ATTENDANCE_MARKED:       'MANAR_ATTENDANCE_MARKED',
  DATA_SYNCED:             'MANAR_DATA_SYNCED',
  COLLEGE_SWITCHED:        'MANAR_COLLEGE_SWITCH',
  SETTINGS_UPDATED:        'MANAR_SYSTEM_SETTINGS_UPDATE',
  SW_UPDATE_AVAILABLE:     'MANAR_SW_UPDATE_AVAILABLE',
  EXCHANGE_POST_CREATED:   'MANAR_EXCHANGE_POST_CREATED',
  EXCHANGE_POST_DELETED:   'MANAR_EXCHANGE_POST_DELETED',
  EXCHANGE_COMMENT_CREATED:'MANAR_EXCHANGE_COMMENT_CREATED',
  EXCHANGE_COMMENT_DELETED:'MANAR_EXCHANGE_COMMENT_DELETED',
  SANDBOX_UPDATE:          'MANAR_SANDBOX_UPDATE',
  DEV_ACTIVITY_LOG:        'MANAR_DEV_ACTIVITY_LOG',
  THEME_MODE_CHANGED:      'themeModeChanged',
});

// ── Academic Week Index ───────────────────────────────────────────────────────
// Canonical working-week order for Yemeni academic calendar (Sat→Thu)
export const ACADEMIC_DAYS = Object.freeze([
  'SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
]);

// Full week (for JS Date.getDay() mapping)
export const FULL_WEEK_DAYS = Object.freeze([
  'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
]);

// ── Time Slot Index ───────────────────────────────────────────────────────────
// Canonical lecture time slots — matches backend schedule data
export const TIME_SLOTS = Object.freeze([
  { id: 0, start: '08:00', end: '10:00', label: '08:00 AM - 10:00 AM' },
  { id: 1, start: '10:00', end: '12:00', label: '10:00 AM - 12:00 PM' },
  { id: 2, start: '12:00', end: '14:00', label: '12:00 PM - 02:00 PM' },
  { id: 3, start: '14:00', end: '16:00', label: '02:00 PM - 04:00 PM' },
  { id: 4, start: '16:00', end: '18:00', label: '04:00 PM - 06:00 PM' },
]);

// ── Cache TTL Constants ───────────────────────────────────────────────────────
export const CACHE_TTL = Object.freeze({
  STUDENT_SCHEDULES_MS:    5 * 60 * 1000,   // 5 minutes
  COMMAND_PALETTE_MS:      3 * 60 * 1000,   // 3 minutes
  SYSTEM_SETTINGS_MS:      60 * 60 * 1000,  // 60 minutes
});

// ── Debounce Delays ────────────────────────────────────────────────────────────
export const DEBOUNCE = Object.freeze({
  SSE_FETCH_MS:            600,   // SSE event → fetchData debounce window
});
