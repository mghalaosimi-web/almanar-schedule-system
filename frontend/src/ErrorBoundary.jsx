import React from 'react';

/**
 * ErrorBoundary — catches any JavaScript render error in child components
 * and displays the exact error.message + error.stack for debugging.
 *
 * Uses 100% inline styles (no Tailwind / CSS classes) so it renders
 * correctly even when the stylesheet fails to load.
 *
 * NOTE: position is NOT fixed — Android WebView / Capacitor can mis-handle
 * fixed positioning during first paint, causing a blank screen instead of
 * the fallback UI.  We use a simple block-flow full-viewport container.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      info: null,
      hoverPrimary: false,
      hoverSecondary: false,
      isAutoReloading: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[ErrorBoundary] ===== RENDER ERROR =====');
    console.error('[ErrorBoundary] message:', error?.message);
    console.error('[ErrorBoundary] stack:', error?.stack);
    console.error('[ErrorBoundary] componentStack:', info?.componentStack);
    console.error('[ErrorBoundary] ==========================');

    // Automatically recover from ChunkLoadError / Vite dynamic import failures
    const isChunkError = error && (
      error.name === 'ChunkLoadError' || 
      /failed to fetch dynamically imported module/i.test(error.message) ||
      /loading chunk/i.test(error.message) ||
      /dynamically imported module/i.test(error.message)
    );

    if (isChunkError) {
      console.warn('[ErrorBoundary] Chunk load failure detected. Clearing cache and auto-reloading...');
      this.setState({ isAutoReloading: true });
      this.handleReload();
    }
  }

  handleReload = () => {
    // Unregister all service workers and clear every cache, then hard-reload
    const clearAndReload = () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => regs.forEach((r) => r.unregister()))
          .catch(() => {});
      }
      if ('caches' in window) {
        caches
          .keys()
          .then((names) => Promise.all(names.map((n) => caches.delete(n))))
          .catch(() => {});
      }
      setTimeout(() => {
        try {
          window.location.reload(true);
        } catch {
          window.location.href = '/';
        }
      }, 400);
    };
    clearAndReload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, info, hoverPrimary, hoverSecondary, isAutoReloading } = this.state;
    const msg   = error?.message  || 'Unknown error — no message provided.';
    const stack = error?.stack    || 'No stack trace available.';
    const comp  = info?.componentStack || 'No component stack available.';

    const isAr = (localStorage.getItem('manar_lang') || 'en') === 'ar';

    /* ── inline style tokens ───────────────────────────────────── */
    const root = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #0b1120 0%, #030712 100%)',
      color: '#e2e8f0',
      fontFamily: "'Urbanist', system-ui, -apple-system, sans-serif",
      boxSizing: 'border-box',
      padding: '32px 16px',
      direction: isAr ? 'rtl' : 'ltr',
    };

    const card = {
      position: 'relative',
      width: '100%',
      maxWidth: '460px',
      background: 'rgba(17, 24, 39, 0.65)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '28px',
      padding: '40px 28px 32px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
    };

    const iconContainer = {
      width: '64px',
      height: '64px',
      borderRadius: '20px',
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '20px',
      color: '#ef4444',
      boxShadow: '0 0 20px rgba(239, 68, 68, 0.15)',
    };

    const title = {
      margin: '0 0 12px 0',
      fontSize: '20px',
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: '-0.02em',
      lineHeight: '1.3',
    };

    const description = {
      margin: '0 0 28px 0',
      fontSize: '12px',
      color: '#9ca3af',
      lineHeight: '1.6',
      fontWeight: '600',
      padding: '0 10px',
    };

    const btnPrimary = {
      width: '100%',
      padding: '14px 20px',
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: '#022c22',
      border: 'none',
      borderRadius: '16px',
      fontSize: '12px',
      fontWeight: '900',
      cursor: 'pointer',
      fontFamily: 'inherit',
      boxShadow: '0 8px 20px rgba(16, 185, 129, 0.15)',
      transition: 'all 0.2s ease',
      marginBottom: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    };

    const btnPrimaryHover = {
      background: 'linear-gradient(135deg, #34d399 0%, #059669 100%)',
      transform: 'translateY(-1px)',
      boxShadow: '0 12px 24px rgba(16, 185, 129, 0.25)',
    };

    const btnSecondary = {
      width: '100%',
      padding: '13px 20px',
      background: 'rgba(255, 255, 255, 0.03)',
      color: '#9ca3af',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '16px',
      fontSize: '11px',
      fontWeight: '700',
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'all 0.2s ease',
      marginBottom: '32px',
    };

    const btnSecondaryHover = {
      background: 'rgba(255, 255, 255, 0.07)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.15)',
    };

    const detailsContainer = {
      width: '100%',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      background: 'rgba(0, 0, 0, 0.2)',
      overflow: 'hidden',
      textAlign: isAr ? 'right' : 'left',
    };

    const detailsSummary = {
      padding: '12px 16px',
      fontSize: '10px',
      fontWeight: '800',
      color: '#9ca3af',
      cursor: 'pointer',
      userSelect: 'none',
      outline: 'none',
      listStyle: 'none',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    };

    const errorDetailsTitle = {
      fontSize: '10px',
      fontWeight: '850',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#ef4444',
      margin: '0 0 6px 0',
      textAlign: 'left',
    };

    const codeBox = {
      margin: 0,
      padding: '16px',
      fontSize: '10px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      lineHeight: '1.6',
      wordBreak: 'break-all',
      whiteSpace: 'pre-wrap',
      overflowX: 'auto',
      color: '#ef4444',
      background: 'rgba(239, 68, 68, 0.02)',
      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      maxHeight: '140px',
      overflowY: 'auto',
      textAlign: 'left',
    };

    const footer = {
      marginTop: '20px',
      fontSize: '9px',
      color: '#374151',
      fontWeight: '700',
      letterSpacing: '0.08em',
    };

    if (isAutoReloading) {
      return (
        <div style={root}>
          <div style={card}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              color: '#10b981',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.15)',
            }}>
              <span style={{ display: 'inline-block', fontSize: '24px' }}>🔄</span>
            </div>
            <h1 style={title}>
              {isAr ? 'جاري تحديث التطبيق تلقائياً...' : 'Updating Application...'}
            </h1>
            <p style={description}>
              {isAr 
                ? 'تم اكتشاف تحديث جديد للنظام. نقوم بتهيئة الملفات ومسح التخزين المؤقت لضمان استقرار التطبيق.' 
                : 'A new system update was detected. Automatically clearing cache and loading new assets to ensure stability.'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div style={root}>
        <style>{`
          details summary::-webkit-details-marker {
            display: none;
          }
        `}</style>

        <div style={card}>
          {/* Icon */}
          <div style={iconContainer}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>

          {/* Bilingual Reassuring Title */}
          <h1 style={title}>
            {isAr ? 'عذراً، حدث خطأ غير متوقع' : 'Oops! Something went wrong'}
          </h1>

          {/* Bilingual Reassuring Description */}
          <p style={description}>
            {isAr 
              ? 'واجه التطبيق مشكلة مؤقتة في تحميل بعض الملفات. غالباً ما يكون ذلك بسبب تحديث جديد للنظام أو ضعف في اتصال الإنترنت.' 
              : 'The app encountered a temporary loading error. This is usually caused by an ongoing server update or a weak network connection.'}
            <br />
            <span style={{ display: 'block', marginTop: '8px', color: '#6b7280', fontSize: '11px' }}>
              {isAr 
                ? 'يرجى الضغط على زر التحديث أدناه لمسح التخزين المؤقت وحل المشكلة.' 
                : 'Please click the reload button below to clear the cache and resolve the issue.'}
            </span>
          </p>

          {/* Actions */}
          <button 
            style={hoverPrimary ? { ...btnPrimary, ...btnPrimaryHover } : btnPrimary} 
            onClick={this.handleReload}
            onMouseEnter={() => this.setState({ hoverPrimary: true })}
            onMouseLeave={() => this.setState({ hoverPrimary: false })}
          >
            🔄 {isAr ? 'تحديث وإعادة تحميل التطبيق' : 'Clear Cache & Reload App'}
          </button>

          <button
            style={hoverSecondary ? { ...btnSecondary, ...btnSecondaryHover } : btnSecondary}
            onClick={() => this.setState({ hasError: false, error: null, info: null })}
            onMouseEnter={() => this.setState({ hoverSecondary: true })}
            onMouseLeave={() => this.setState({ hoverSecondary: false })}
          >
            {isAr ? 'محاولة المتابعة بدون تحديث' : 'Try Again Without Reloading'}
          </button>

          {/* Collapsible Technical Logs */}
          <details style={detailsContainer}>
            <summary style={detailsSummary}>
              <span>{isAr ? '🛠️ التفاصيل التقنية للمطورين' : '🛠️ Advanced Technical Logs'}</span>
              <span style={{ fontSize: '8px', color: '#9ca3af' }}>▼</span>
            </summary>
            
            <div style={{ padding: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <h4 style={errorDetailsTitle}>Error Message</h4>
              <pre style={{ ...codeBox, borderTop: 'none', padding: '0 0 12px 0' }}>{msg}</pre>
              
              <h4 style={{ ...errorDetailsTitle, marginTop: '12px' }}>Stack Trace</h4>
              <pre style={codeBox}>{stack}</pre>
              
              <h4 style={{ ...errorDetailsTitle, marginTop: '12px' }}>Component Tree</h4>
              <pre style={codeBox}>{comp}</pre>
            </div>
          </details>

          {/* Footer Info */}
          <p style={footer}>
            MANAR SCHEDULE SYSTEM · STABLE ERROR ESCAPE v3
          </p>
        </div>
      </div>
    );
  }
}
