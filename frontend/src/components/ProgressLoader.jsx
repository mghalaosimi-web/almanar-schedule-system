import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function ProgressLoader() {
  // Top progress bar states
  const [showBar, setShowBar] = useState(false);
  const [barProgress, setBarProgress] = useState(0);

  // Full-screen overlay loader states
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayProgress, setOverlayProgress] = useState(1);
  const [overlayMessage, setOverlayMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Refs for tracking timers and counters
  const barTimeoutRef = useRef(null);
  const barIntervalRef = useRef(null);
  const overlayIntervalRef = useRef(null);
  const successTimeoutRef = useRef(null);

  useEffect(() => {
    // ── Handle standard Axios request indicators (Top Progress Bar) ──
    const handleRequestStart = () => {
      if (showOverlay) return; // Don't show bar if overlay is active
      
      // Anti-flicker delay: only show loader if request takes >180ms
      if (barTimeoutRef.current) clearTimeout(barTimeoutRef.current);
      barTimeoutRef.current = setTimeout(() => {
        setShowBar(true);
        setBarProgress(15); // Start at 15%

        if (barIntervalRef.current) clearInterval(barIntervalRef.current);
        // Gradually increment up to 85%
        barIntervalRef.current = setInterval(() => {
          setBarProgress((prev) => {
            if (prev >= 85) {
              clearInterval(barIntervalRef.current);
              return 85;
            }
            return prev + Math.floor(Math.random() * 5) + 2;
          });
        }, 200);
      }, 180);
    };

    const handleRequestEnd = () => {
      if (barTimeoutRef.current) clearTimeout(barTimeoutRef.current);
      if (barIntervalRef.current) clearInterval(barIntervalRef.current);

      if (showBar) {
        setBarProgress(100);
        setTimeout(() => {
          setShowBar(false);
          setBarProgress(0);
        }, 300);
      }
    };

    // ── Handle Large Operations (Full-screen Modal with 1 to 10 counting) ──
    const handleLargeOpStart = (e) => {
      // Clear any pending bar loaders
      if (barTimeoutRef.current) clearTimeout(barTimeoutRef.current);
      if (barIntervalRef.current) clearInterval(barIntervalRef.current);
      setShowBar(false);

      const message = e.detail?.message || '';
      setOverlayMessage(message);
      setIsSuccess(false);
      setOverlayProgress(1);
      setShowOverlay(true);

      if (overlayIntervalRef.current) clearInterval(overlayIntervalRef.current);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);

      // Organic counter: count from 1 to 9 (slower for larger operations)
      let currentVal = 1;
      overlayIntervalRef.current = setInterval(() => {
        if (currentVal < 9) {
          currentVal += 1;
          setOverlayProgress(currentVal);
        } else {
          clearInterval(overlayIntervalRef.current);
        }
      }, 450);
    };

    const handleLargeOpEnd = () => {
      if (overlayIntervalRef.current) clearInterval(overlayIntervalRef.current);

      // Snap to 10 (100% complete)
      setOverlayProgress(10);
      setIsSuccess(true);

      // Hold success checkmark state for 600ms before fading out
      successTimeoutRef.current = setTimeout(() => {
        setShowOverlay(false);
      }, 600);
    };

    window.addEventListener('axios-request-start', handleRequestStart);
    window.addEventListener('axios-request-end', handleRequestEnd);
    window.addEventListener('large-operation-start', handleLargeOpStart);
    window.addEventListener('large-operation-end', handleLargeOpEnd);

    return () => {
      window.removeEventListener('axios-request-start', handleRequestStart);
      window.removeEventListener('axios-request-end', handleRequestEnd);
      window.removeEventListener('large-operation-start', handleLargeOpStart);
      window.removeEventListener('large-operation-end', handleLargeOpEnd);
      if (barTimeoutRef.current) clearTimeout(barTimeoutRef.current);
      if (barIntervalRef.current) clearInterval(barIntervalRef.current);
      if (overlayIntervalRef.current) clearInterval(overlayIntervalRef.current);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, [showBar, showOverlay]);

  // Compute circular SVG dashboard metrics
  const radius = 42;
  const strokeDasharray = 2 * Math.PI * radius;
  // Map progress (1 to 10) to circular dashoffset
  const strokeDashoffset = strokeDasharray - (strokeDasharray * (overlayProgress / 10));

  return (
    <>
      {/* ── 1. Top progress bar ── */}
      {showBar && (
        <div className="global-progress-container">
          <div 
            className="global-progress-bar shimmer" 
            style={{ width: `${barProgress}%` }}
          />
        </div>
      )}

      {/* ── 2. Full screen overlay modal ── */}
      <AnimatePresence>
        {showOverlay && (
          <div className="loader-overlay">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="loader-card"
            >
              {/* Spinning progress dashboard */}
              <div className="spinner-circle-wrapper">
                <svg className="spinner-svg">
                  <circle className="spinner-track" cx="50" cy="50" r={radius} />
                  <motion.circle 
                    className="spinner-indicator" 
                    cx="50" 
                    cy="50" 
                    r={radius}
                    strokeDasharray={strokeDasharray}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  />
                </svg>
                <div className="spinner-number">
                  {isSuccess ? '✓' : overlayProgress}
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <p className="loader-message">
                  {isSuccess ? 'تم التحميل بنجاح!' : (overlayMessage || 'جاري تحميل الطلب...')}
                </p>
                <p className="loader-sub">
                  {isSuccess ? '10 / 10' : `${overlayProgress} / 10`}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
