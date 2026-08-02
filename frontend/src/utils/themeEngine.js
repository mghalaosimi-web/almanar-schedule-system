/**
 * @file themeEngine.js
 * @description محرك الثيمات الموحّد (Single Source of Truth).
 * يحل مشكلة تعارض مصادر --accent الثلاثة (index.css, ThemeSwitcher.jsx, App.jsx).
 * نظام أولويات واضح:
 *   Priority 3 (OTA)     — لون الجامعة الـ Over-The-Air من الخادم (الأعلى)
 *   Priority 2 (USER)    — اختيار المستخدم من ThemeSwitcher
 *   Priority 1 (DEFAULT) — القيم الافتراضية في index.css (الأدنى)
 */

const PRIORITY = {
  DEFAULT: 1,
  USER: 2,
  OTA: 3,
};

/** الأولوية الحالية المفعّلة */
let _currentPriority = PRIORITY.DEFAULT;

/**
 * تحويل Hex إلى سلسلة RGB (r, g, b)
 * @param {string} hex - اللون بصيغة #RRGGBB أو #RGB
 * @returns {string} e.g. "245, 158, 11"
 */
function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const num = parseInt(hex, 16);
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

/**
 * تطبيق لون اللكسنت على الـ CSS custom properties.
 * @param {string} hex   - اللون بصيغة #RRGGBB
 * @param {'DEFAULT'|'USER'|'OTA'} source - مصدر التغيير
 * @returns {boolean} true إذا تم التطبيق، false إذا رُفض بسبب الأولوية
 */
export function applyAccentColor(hex, source = 'USER') {
  const incomingPriority = PRIORITY[source] ?? PRIORITY.DEFAULT;

  // لا تتجاوز مصدراً بأولوية أعلى
  if (incomingPriority < _currentPriority) return false;

  _currentPriority = incomingPriority;

  const rgb = hexToRgb(hex);
  const root = document.documentElement;

  root.style.setProperty('--accent', hex);
  root.style.setProperty('--accent-dim', `rgba(${rgb}, 0.12)`);
  root.style.setProperty('--accent-glow', `rgba(${rgb}, 0.25)`);
  root.style.setProperty('--primary-color-rgb', rgb);
  root.style.setProperty('--primary-hover-rgb', rgb);
  root.style.setProperty('--glow-lime', `rgba(${rgb}, 0.10)`);

  // إشعار المكوّنات الأخرى
  window.dispatchEvent(new CustomEvent('MANAR_ACCENT_APPLIED', { detail: { hex, source } }));
  return true;
}

/**
 * مسح لون اللكسنت (إعادة التحكم للـ CSS classes).
 * يُستخدم عند التبديل من ثيم custom لثيم مُصنَّف.
 * @param {'DEFAULT'|'USER'|'OTA'} bySource - المصدر الذي يطلب المسح
 */
export function clearAccentColor(bySource = 'USER') {
  const incomingPriority = PRIORITY[bySource] ?? PRIORITY.DEFAULT;
  if (incomingPriority < _currentPriority) return;

  _currentPriority = PRIORITY.DEFAULT;

  const root = document.documentElement;
  root.style.removeProperty('--accent');
  root.style.removeProperty('--accent-dim');
  root.style.removeProperty('--accent-glow');
  root.style.removeProperty('--primary-color-rgb');
  root.style.removeProperty('--primary-hover-rgb');
  root.style.removeProperty('--glow-lime');

  window.dispatchEvent(new CustomEvent('MANAR_ACCENT_APPLIED', { detail: { hex: null, source: bySource } }));
}

/**
 * تطبيق OTA لون الجامعة من الـ localStorage / SSE.
 * هذا المصدر يتغلب على اختيار المستخدم.
 * @param {string|null} otaColor - اللون من الإعدادات أو null لإزالة OTA
 * @param {string|null} fallbackColor - لون المستخدم/الجامعة كـ fallback
 */
export function applyOtaTheme(otaColor, fallbackColor = null) {
  if (otaColor) {
    applyAccentColor(otaColor, 'OTA');
  } else {
    // إزالة OTA، العودة لـ USER priority
    _currentPriority = PRIORITY.USER;
    if (fallbackColor) {
      applyAccentColor(fallbackColor, 'USER');
    } else {
      clearAccentColor('USER');
    }
  }
}

/**
 * قراءة لون الجامعة/المستخدم من الـ localStorage وتطبيقه.
 * يُستدعى عند cold load أو تغيير الجامعة.
 */
export function restoreUserTheme() {
  try {
    // ── 0. Restore dark/light mode class first (prevents FOUC) ──
    const themeMode = localStorage.getItem('manar_theme_mode') || 'dark';
    const htmlEl = document.documentElement;
    if (themeMode === 'light') {
      htmlEl.classList.add('light');
      htmlEl.classList.remove('dark');
    } else if (themeMode === 'dark') {
      htmlEl.classList.remove('light');
      htmlEl.classList.add('dark');
    } else if (themeMode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        htmlEl.classList.remove('light');
        htmlEl.classList.add('dark');
      } else {
        htmlEl.classList.add('light');
        htmlEl.classList.remove('dark');
      }
    }

    const userJson = localStorage.getItem('manar_user');
    let user = null;
    try { user = JSON.parse(userJson); } catch {}

    // OTA أعلى أولوية
    const cachedSettings = JSON.parse(localStorage.getItem('cached_system_settings') || '{}');
    const otaColor = cachedSettings.otaThemeColor;
    if (otaColor) {
      applyAccentColor(otaColor, 'OTA');
      return;
    }

    // بعد ذلك لون اختيار المستخدم (custom theme)
    const userTheme = localStorage.getItem('manar_theme_color');
    if (userTheme === 'custom') {
      const customHex = localStorage.getItem('manar_custom_accent');
      if (customHex) {
        applyAccentColor(customHex, 'USER');
        return;
      }
    }

    // بعد ذلك لون الجامعة
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const universityColor = isSuperAdmin
      ? localStorage.getItem('superadmin_selectedThemeColor')
      : (user?.themeColor || localStorage.getItem('selectedUniversityThemeColor'));

    if (universityColor) {
      applyAccentColor(universityColor, 'USER');
      return;
    }

    // لا لون محدد — دع CSS يتحكم
    clearAccentColor('USER');
  } catch (e) {
    console.warn('[ThemeEngine] restoreUserTheme failed:', e);
  }
}

/**
 * الحصول على الأولوية الحالية
 * @returns {'DEFAULT'|'USER'|'OTA'}
 */
export function getCurrentPriority() {
  return Object.keys(PRIORITY).find(k => PRIORITY[k] === _currentPriority) || 'DEFAULT';
}
