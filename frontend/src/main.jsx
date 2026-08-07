import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/fill";
import "@phosphor-icons/web/bold";
import App from './App.jsx'
import { EntityProvider } from './context/EntityProvider.jsx'
import './i18n'
import { restoreUserTheme } from './utils/themeEngine.js'

import { registerSW } from 'virtual:pwa-register'

// ── Immediately restore theme mode to prevent FOUC (Flash of Unstyled Content) ──
// Must run synchronously BEFORE React renders any component.
restoreUserTheme();

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EntityProvider><App /></EntityProvider>
  </StrictMode>,
)
