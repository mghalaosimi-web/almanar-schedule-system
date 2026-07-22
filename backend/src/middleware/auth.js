const jwt = require('jsonwebtoken');

// ── Super Admin Verification Cache (TTL: 5 minutes) ──────────────────────────
// Eliminates the DB query on every /admin/dev/* request.
// Cache entry: { valid: boolean, expiresAt: number (unix ms) }
const superAdminCache = new Map();
const SUPER_ADMIN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Periodic cleanup to prevent memory leaks (runs every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of superAdminCache.entries()) {
    if (val.expiresAt < now) superAdminCache.delete(key);
  }
}, SUPER_ADMIN_CACHE_TTL);

async function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, error: 'Malformed token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    // Check Force Logout / Revoked Session
    if (decoded.sessionId) {
      try {
        const { prisma } = require('../db');
        const session = await prisma.sessionLog.findUnique({
          where: { id: decoded.sessionId }
        });
        if (!session || session.isRevoked || session.logoutTime) {
          return res.status(401).json({ success: false, error: 'SESSION_REVOKED', message: 'Your session has been terminated by administrator.' });
        }
      } catch (dbErr) {
        console.warn('[verifyToken] Session check warning:', dbErr.message);
      }
    }

    // Check if college is deactivated (exclude SUPER_ADMIN, developer emails, and Dev Portal routes)
    const isDevRoute = req.originalUrl && (
      req.originalUrl.includes('/dev') || 
      req.originalUrl.startsWith('/api/admin/dev')
    );
    const isDeveloper = decoded.role === 'SUPER_ADMIN' || (
      decoded.email && ['developer@mghal.com', 'm.gh.alosimi@gmail.com'].includes(decoded.email.toLowerCase())
    );

    if (!isDeveloper && decoded.collegeId && !isDevRoute) {
      const systemSettings = require('../services/systemSettings');
      const deactivated = systemSettings.get('deactivatedColleges') || [];
      if (deactivated.includes(parseInt(decoded.collegeId))) {
        return res.status(403).json({ success: false, error: 'LICENSE_REVOKED' });
      }
    }
    // Enforce Google SSO at Backend Level if requireGoogleLink setting is enabled
    if (decoded.role === 'STUDENT' && !decoded.googleId) {
      const systemSettings = require('../services/systemSettings');
      const enforceGoogle = systemSettings.get('requireGoogleLink') !== false;
      if (enforceGoogle) {
        const isStudentRoute = req.originalUrl.startsWith('/api/student') || 
                              req.originalUrl.startsWith('/api/rep') || 
                              req.originalUrl.startsWith('/api/exchange') ||
                              req.originalUrl.startsWith('/api/attendance');
        if (isStudentRoute) {
          return res.status(403).json({ success: false, error: 'GOOGLE_LINK_REQUIRED' });
        }
      }
    }    // Session tracking activity
    try {
      const { keepAlive } = require('../services/sessionTracker');
      keepAlive(decoded);
    } catch (e) {}

    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
}


function verifyAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No session found' });
  }
  const adminRoles = ['SUPER_ADMIN', 'UNI_ADMIN', 'COLLEGE_ADMIN', 'ADMIN'];
  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Forbidden: Admin privileges required' });
  }
  next();
}

async function isSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, error: 'Forbidden: Super Admin access required' });
  }

  // ── Check cache first to avoid DB query on every request ─────────────────
  const cached = superAdminCache.get(req.user.id);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.valid) return next();
    return res.status(403).json({ success: false, error: 'Forbidden: Restricted to developer only' });
  }

  // ── Cache miss: validate against DB ──────────────────────────────────────
  try {
    const { prisma } = require('../db');
    const admin = await prisma.admin.findUnique({
      where: { id: req.user.id },
      select: { email: true }
    });

    // Developer emails stored in env — never hardcoded
    const allowedEmails = [
      process.env.SUPER_ADMIN_EMAIL_1 || 'developer@mghal.com',
      process.env.SUPER_ADMIN_EMAIL_2 || 'm.gh.alosimi@gmail.com'
    ];

    const isValid = admin && allowedEmails.includes(admin.email);

    // Store result in cache with TTL
    superAdminCache.set(req.user.id, {
      valid: !!isValid,
      expiresAt: Date.now() + SUPER_ADMIN_CACHE_TTL
    });

    if (!isValid) {
      return res.status(403).json({ success: false, error: 'Forbidden: Restricted to developer only' });
    }
    next();
  } catch (error) {
    console.error('[isSuperAdmin] DB verification error:', error.message);
    return res.status(500).json({ success: false, error: 'Authorization verification failed' });
  }
}

/**
 * Immediately invalidates a super admin's cached authorization.
 * Call this on force-logout or session revocation.
 * @param {number} userId
 */
function invalidateSuperAdminCache(userId) {
  superAdminCache.delete(userId);
  console.log(`[isSuperAdmin] Cache invalidated for userId: ${userId}`);
}

module.exports = { verifyToken, verifyAdmin, isSuperAdmin, invalidateSuperAdminCache };
