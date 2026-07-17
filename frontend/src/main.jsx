import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './i18n'
import { GoogleOAuthProvider } from '@react-oauth/google'

import { registerSW } from 'virtual:pwa-register'

// Register Service Worker for PWA with prompt update logic
try {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Dispatch a custom event to notify App.jsx that an update is available
      window.dispatchEvent(new CustomEvent('MANAR_SW_UPDATE_AVAILABLE', {
        detail: {
          updateHandler: () => {
            updateSW(true);
          }
        }
      }));
    },
    onOfflineReady() {
      console.log('[PWA] App ready to work offline.');
    },
    onRegistered(r) {
      if (r) {
        console.log('[PWA] Service Worker registered:', r);
      }
    },
    onRegisterError(error) {
      console.warn('[PWA] Service Worker registration failed:', error);
    },
  });
} catch (e) {
  console.warn('[PWA] registerSW failed (possibly in dev mode):', e);
}

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '425434500913-qd4j47g4pf11dq8plpr8c7n4s9mi5q84.apps.googleusercontent.com';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
