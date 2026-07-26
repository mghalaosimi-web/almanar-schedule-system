import { SESSION_KEYS } from './constants';

const safeParse = (value, fallback = null) => {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
};

const decodeJwtPayload = (token) => {
  try {
    const payload = token.split('.')[1];
    return safeParse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
};

/** Single gateway for authentication session persistence. */
export const SessionService = Object.freeze({
  getUser: () => safeParse(localStorage.getItem(SESSION_KEYS.USER)),
  getToken: () => localStorage.getItem(SESSION_KEYS.TOKEN),
  getStudentProfile: () => safeParse(localStorage.getItem(SESSION_KEYS.STUDENT_PROFILE), {}),
  setSession: ({ token, user, studentProfile }) => {
    if (token) localStorage.setItem(SESSION_KEYS.TOKEN, token);
    if (user) localStorage.setItem(SESSION_KEYS.USER, JSON.stringify(user));
    if (studentProfile) localStorage.setItem(SESSION_KEYS.STUDENT_PROFILE, JSON.stringify(studentProfile));
    window.dispatchEvent(new CustomEvent('MANAR_SESSION_CHANGED'));
  },
  updateUser: (user) => {
    if (user) localStorage.setItem(SESSION_KEYS.USER, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('MANAR_SESSION_CHANGED'));
  },
  isExpired: () => {
    const payload = decodeJwtPayload(localStorage.getItem(SESSION_KEYS.TOKEN) || '');
    return Boolean(payload?.exp && Date.now() >= payload.exp * 1000);
  },
  logout: ({ preserveImpersonation = false } = {}) => {
    [SESSION_KEYS.TOKEN, SESSION_KEYS.USER, SESSION_KEYS.STUDENT_PROFILE].forEach((key) => localStorage.removeItem(key));
    if (!preserveImpersonation) {
      localStorage.removeItem(SESSION_KEYS.IMPERSONATE_TOKEN);
      localStorage.removeItem(SESSION_KEYS.IMPERSONATE_USER);
    }
    window.dispatchEvent(new CustomEvent('MANAR_SESSION_CHANGED'));
  },
  refresh: async (refreshRequest) => {
    if (typeof refreshRequest !== 'function') return null;
    const session = await refreshRequest();
    if (session?.token || session?.user) SessionService.setSession(session);
    return session;
  },
});
