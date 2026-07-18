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

  try {
    const ticket  = await googleOAuthClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    return {
      googleId: payload.sub,
      email:    payload.email,
      name:     payload.name || payload.given_name || payload.email.split('@')[0],
      picture:  payload.picture,
      verified: true,
    };
  } catch (err) {
    console.warn('[GOOGLE VERIFY] JWT verification failed, attempting fallback userinfo:', err.message);
    return new Promise((resolve) => {
      const https   = require('https');
      const options = {
        hostname: 'www.googleapis.com',
        path:     '/oauth2/v3/userinfo',
        method:   'GET',
        headers:  { Authorization: `Bearer ${token}` },
      };
      https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.email) {
              resolve({ googleId: parsed.sub, email: parsed.email, name: parsed.name || parsed.email.split('@')[0], picture: parsed.picture, verified: true });
            } else {
              resolve({ verified: false, error: parsed.error_description || 'Invalid token' });
            }
          } catch (e) {
            resolve({ verified: false, error: 'Failed to parse Google verification response' });
          }
        });
      }).on('error', (netErr) => {
        console.error('[GOOGLE VERIFY] Fallback network error:', netErr);
        resolve({ verified: false, error: 'Google verification network error' });
      });
    });
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
