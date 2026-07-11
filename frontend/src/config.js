const rawApiUrl = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined'
    ? (import.meta.env.PROD
        ? window.location.origin
        : `${window.location.protocol}//${window.location.hostname}:5001`)
    : (import.meta.env.PROD
        ? 'https://manar-schedule-system.onrender.com'
        : 'http://localhost:5001')
);

export const API_URL = rawApiUrl.replace(/\/api\/?$/, '');
