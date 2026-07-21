const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
  }
  if (typeof window === 'undefined') {
    return 'https://almanar-schedule-system.onrender.com';
  }
  
  // Connect to production server in production builds (Capacitor / built apps)
  const isDev = import.meta.env.DEV;
  if (!isDev) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'https://almanar-schedule-system.onrender.com';
    }
    return window.location.origin;
  }

  // Development mode: use local backend
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `${window.location.protocol}//${window.location.hostname}:5001`;
  }
  return window.location.origin;
};

export const API_URL = getApiUrl();
