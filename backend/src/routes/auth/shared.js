/**
 * auth/shared.js — Shared state and helpers for auth routes
 * 
 * Contains:
 * - In-memory captchaStore / otpStore (with periodic cleanup)
 * - Rate-limiter instances (authLimiter, otpLimiter, strictAuthLimiter)
 * - verifyGoogleToken() helper
 * 
 * All auth sub-modules import from this file to avoid circular deps
 * and duplicate in-memory Maps.
 */

const rateLimit         = require('express-rate-limit');
const { OAuth2Client }  = require('google-auth-library');

// ── In-memory stores ──────────────────────────────────────────────────────────
const captchaStore = new Map();
const otpStore     = new Map();

// Periodic cleanup every 10 minutes — prevents memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of captchaStore.entries()) {
    if (val.expires < now) captchaStore.delete(key);
  }
  for (const [key, val] of otpStore.entries()) {
    if (val.expires < now) otpStore.delete(key);
  }
}, 10 * 60 * 1000);

// ── Google OAuth client ───────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
if (!GOOGLE_CLIENT_ID) {
  console.error('[GOOGLE AUTH] ⚠️  VITE_GOOGLE_CLIENT_ID is not set. Google login will be disabled.');
}
const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ── Rate Limiters ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many authentication attempts from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many OTP requests from this IP, please try again after an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many authentication attempts from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Google Token Verifier ─────────────────────────────────────────────────────
async function verifyGoogleToken(token) {
  if (!token) return { verified: false, error: 'Token is missing' };

  if (token.startsWith('mock_token_for_')) {
    if (process.env.NODE_ENV !== 'development') {
      return { verified: false, error: 'Mock tokens are only allowed in development environment' };
    }
    const parts = token.substring('mock_token_for_'.length).split('_');
    const email = parts[0];
    const name  = parts[1] ? decodeURIComponent(parts[1]) : email.split('@')[0];
    return { googleId: 'mock_google_id_' + email, email, name, verified: true };
  }

  if (!GOOGLE_CLIENT_ID) {
    return { verified: false, code: 'GOOGLE_CONFIGURATION_ERROR', error: 'Google sign-in is not configured' };
  }

  try {
    const ticket  = await googleOAuthClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const validIssuer = payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com';
    if (!validIssuer || !payload.sub || !payload.email || payload.email_verified !== true) {
      return { verified: false, code: 'GOOGLE_INVALID_TOKEN', error: 'Google identity claims are invalid' };
    }
    return {
      googleId: payload.sub,
      email:    payload.email,
      name:     payload.name || payload.given_name || payload.email.split('@')[0],
      picture:  payload.picture,
      email_verified: true,
      verified: true,
    };
  } catch (err) {
    // An ID token must never be reinterpreted as an OAuth access token.  The
    // caller receives a classified authentication failure instead.
    console.warn('[GOOGLE VERIFY] ID token verification failed:', err.message);
    return { verified: false, code: 'GOOGLE_INVALID_TOKEN', error: 'Google ID token verification failed' };
  }
}

module.exports = {
  captchaStore,
  otpStore,
  authLimiter,
  otpLimiter,
  strictAuthLimiter,
  verifyGoogleToken,
  GOOGLE_CLIENT_ID,
};
