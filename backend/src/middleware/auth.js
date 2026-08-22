const jwt = require('jsonwebtoken');
const { getUserPermissions, hasPermission, requirePermission } = require('./rbac');

// ── Super Admin Verification Cache (TTL: 5 minutes) ──────────────────────────
const superAdminCache = new Map();
const SUPER_ADMIN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of superAdminCache.entries()) {
    if (val.expiresAt < now) superAdminCache.delete(key);
  }
}, SUPER_ADMIN_CACHE_TTL);

/**
 * verifyToken — Backward-compatible JWT middleware.
 *
 * Supports two token formats:
 *   NEW  (SessionManager): { userId, sessionId, email, roles }  → validates via DB session
 *   OLD  (legacy):         { id, role, email, name, ... }       → validates via JWT signature only
 *
 * This dual-path ensures existing user sessions (old tokens in localStorage)
 * continue to work alongside new sessions created by SessionManager.
 */
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
    const JWT_SECRET = process.env.JWT_SECRET;
    
    // Pre-decode to detect token format without verifying signature
    const rawDecoded = jwt.decode(token);
    if (!rawDecoded) {
      return res.status(403).json({ success: false, error: 'Invalid token format' });
    }

    // NEW FORMAT: has both userId and sessionId (from SessionManager.createSession)
    const isNewFormat = !!(rawDecoded.userId && rawDecoded.sessionId);

    if (isNewFormat) {
      // ── Validate via SessionManager (DB session lookup) ──────────────────
      const SessionManager = require('../services/sessionManager');
      const valResult = await SessionManager.validateSession(token);

      if (!valResult.valid) {
        return res.status(401).json({
          success: false,
          error: valResult.error || 'SESSION_INVALID',
          message: 'Your session is invalid, expired, or terminated.'
        });
      }

      const { user, decoded } = valResult;
      const userRoleKeys = (user.roles || []).map(r => r.role?.key || r.role);
      const primaryRole = userRoleKeys[0] || (user.student ? 'STUDENT' : user.lecturer ? 'LECTURER' : 'ADMIN');

      req.user = {
        id: user.id,                        // UUID (canonical User.id for new system)
        studentId: user.student?.id,        // Integer Student.id
        lecturerId: user.lecturer?.id,
        adminId: user.admin?.id,
        email: user.email,
        displayName: user.displayName,
        role: primaryRole,
        roles: userRoleKeys,
        sessionId: decoded.sessionId,
        collegeId: user.student?.collegeId || user.lecturer?.collegeId || user.admin?.collegeId,
        groupId: user.student?.groupId,
        majorId: user.student?.majorId,
        levelId: user.student?.levelId,
        isRepresentative: user.student?.isRepresentative || false,
        googleId: user.student?.googleId || null,
        universityId: user.admin?.universityId || null,
        permissions: getUserPermissions({ role: primaryRole, roles: userRoleKeys })
      };

      // Session activity keep-alive
      try {
        const { keepAlive } = require('../services/sessionTracker');
        keepAlive(decoded);
      } catch (e) {}

    } else {
      // ── OLD FORMAT: Verify JWT signature + build req.user from token payload ──
      // Old tokens store the Student/Lecturer/Admin integer ID directly in `id`.
      // We do NOT look up the User table to avoid breaking existing sessions.
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (jwtErr) {
        return res.status(403).json({ success: false, error: 'Invalid or expired token' });
      }

      const legacyRole = decoded.role || 'STUDENT';
      const isStudent = legacyRole === 'STUDENT';
      const isLecturer = legacyRole === 'LECTURER';
      const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'UNI_ADMIN'].includes(legacyRole);

      req.user = {
        id: decoded.id,                            // integer PK of Student/Lecturer/Admin table
        studentId: isStudent ? decoded.id : undefined,
        lecturerId: isLecturer ? decoded.id : undefined,
        adminId: isAdmin ? decoded.id : undefined,
        email: decoded.email,
        displayName: decoded.name,
        role: legacyRole,
        roles: [legacyRole],
        sessionId: decoded.sessionId || null,
        collegeId: decoded.collegeId,
        groupId: decoded.groupId,
        majorId: decoded.majorId,
        levelId: decoded.levelId,
        isRepresentative: decoded.isRepresentative || false,
        googleId: decoded.googleId || null,
        universityId: decoded.universityId || null,
        permissions: getUserPermissions({ role: legacyRole, roles: [legacyRole] })
      };
    }

    // ── College deactivation check (skip for admin/dev routes) ──────────────
    const isDevOrAdminRoute = req.originalUrl && (
      req.originalUrl.includes('/dev') ||
      req.originalUrl.startsWith('/api/admin')
    );
    const isAdminUser = ['SUPER_ADMIN', 'UNI_ADMIN', 'COLLEGE_ADMIN', 'ADMIN'].includes(req.user.role) || (
      req.user.email && ['developer@mghal.com', 'm.gh.alosimi@gmail.com'].includes(req.user.email.toLowerCase())
    );

    if (!isAdminUser && req.user.collegeId && !isDevOrAdminRoute) {
      const systemSettings = require('../services/systemSettings');
      const deactivated = systemSettings.get('deactivatedColleges') || [];
      if (deactivated.includes(parseInt(req.user.collegeId))) {
        return res.status(403).json({ success: false, error: 'LICENSE_REVOKED' });
      }
    }

    // ── Google SSO enforcement ──────────────────────────────────────────────
    if (req.user.role === 'STUDENT' && !req.user.googleId) {
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
    }

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

  // Check cache first
  const cached = superAdminCache.get(req.user.id);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.valid) return next();
    return res.status(403).json({ success: false, error: 'Forbidden: Restricted to developer only' });
  }

  try {
    const { prisma } = require('../db');
    // Support both integer ID (old tokens) and string/UUID (new tokens)
    const adminId = req.user.adminId || req.user.id;
    let admin = null;

    // Try by integer adminId first (legacy path)
    if (typeof adminId === 'number') {
      admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { email: true } });
    }
    // Fallback: search by email (works for both old and new tokens)
    if (!admin && req.user.email) {
      admin = await prisma.admin.findFirst({ where: { email: req.user.email }, select: { email: true } });
    }

    const allowedEmails = [
      process.env.SUPER_ADMIN_EMAIL_1 || 'developer@mghal.com',
      process.env.SUPER_ADMIN_EMAIL_2 || 'm.gh.alosimi@gmail.com'
    ];

    const isValid = !!(admin && allowedEmails.includes(admin.email));

    superAdminCache.set(req.user.id, {
      valid: isValid,
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
 * @param {number|string} userId
 */
function invalidateSuperAdminCache(userId) {
  superAdminCache.delete(userId);
  console.log(`[isSuperAdmin] Cache invalidated for userId: ${userId}`);
}

module.exports = { verifyToken, verifyAdmin, isSuperAdmin, invalidateSuperAdminCache, requirePermission, hasPermission };
