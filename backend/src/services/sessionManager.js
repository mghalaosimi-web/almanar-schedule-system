const jwt = require('jsonwebtoken');
const { prisma } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_DURATION_DAYS = 30;

class SessionManager {
  /**
   * Create a durable UserSession in DB and return signed JWT
   */
  static async createSession(user, reqMetadata = {}) {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured on the server.');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        expiresAt,
        metadata: {
          userAgent: reqMetadata.userAgent || null,
          ip: reqMetadata.ip || null,
          platform: reqMetadata.platform || null
        }
      }
    });

    const token = jwt.sign(
      {
        userId: user.id,
        sessionId: session.id,
        email: user.email,
        roles: user.roles || []
      },
      JWT_SECRET,
      { expiresIn: `${SESSION_DURATION_DAYS}d` }
    );

    return { session, token };
  }

  /**
   * Validate session token from request
   */
  static async validateSession(token) {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured on the server.');
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded.sessionId || !decoded.userId) {
        return { valid: false, error: 'INVALID_TOKEN_CLAIMS' };
      }

      const session = await prisma.userSession.findUnique({
        where: { id: decoded.sessionId },
        include: {
          user: {
            include: {
              roles: { include: { role: true } },
              student: true,
              lecturer: true,
              admin: true
            }
          }
        }
      });

      if (!session) {
        return { valid: false, error: 'SESSION_NOT_FOUND' };
      }

      if (session.revokedAt) {
        return { valid: false, error: 'SESSION_REVOKED' };
      }

      if (new Date() > new Date(session.expiresAt)) {
        return { valid: false, error: 'SESSION_EXPIRED' };
      }

      if (!session.user.isActive) {
        return { valid: false, error: 'ACCOUNT_DISABLED' };
      }

      // Touch lastSeenAt asynchronously
      prisma.userSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() }
      }).catch(err => console.error('[SessionManager] Failed to touch lastSeenAt:', err.message));

      return { valid: true, session, user: session.user, decoded };
    } catch (err) {
      return { valid: false, error: 'TOKEN_VERIFICATION_FAILED', details: err.message };
    }
  }

  /**
   * Revoke session
   */
  static async revokeSession(sessionId) {
    return prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() }
    });
  }
}

module.exports = SessionManager;
