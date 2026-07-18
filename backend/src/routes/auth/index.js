/**
 * auth/index.js — Main auth router (entry point)
 * 
 * Aggregates all auth sub-modules into a single Express router.
 * Replaces the monolithic auth.js (1475 lines → 4 focused modules).
 * 
 * Sub-modules:
 *   login.js       — /login (POST)
 *   google.js      — /google, /google-login, /link-google (POST)
 *   register.js    — /register, /verify, /send-otp, /captcha, /complete-profile
 *   impersonate.js — /impersonate, /logout, /system/settings
 * 
 * Shared state (captchaStore, otpStore, rate-limiters, verifyGoogleToken)
 * lives in shared.js — imported by each sub-module independently.
 */

const express = require('express');
const router  = express.Router();

const loginRouter       = require('./login');
const googleRouter      = require('./google');
const registerRouter    = require('./register');
const impersonateRouter = require('./impersonate');

router.use('/', loginRouter);
router.use('/', googleRouter);
router.use('/', registerRouter);
router.use('/', impersonateRouter);

module.exports = router;
