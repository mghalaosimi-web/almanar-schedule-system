const jwt = require('jsonwebtoken');
const { prismaRaw } = require('../db');
const { tenantDbStorage } = require('../utils/tenantContext');
const { getTenantPrisma } = require('../utils/dbFactory');

async function tenantDbMiddleware(req, res, next) {
  let collegeId = null;

  // 1. Try to decode token from authorization header if present
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        collegeId = decoded.collegeId;
      } catch (err) {
        // Token validation failed (could be expired or invalid), let verifyToken handle standard response
      }
    }
  }

  // 2. Fallback to check request parameters
  if (!collegeId && req.body && req.body.collegeId) {
    collegeId = parseInt(req.body.collegeId);
  }
  if (!collegeId && req.query && req.query.collegeId) {
    collegeId = parseInt(req.query.collegeId);
  }

  if (collegeId) {
    try {
      // Find TenantConfig override using the raw, unproxied client
      const config = await prismaRaw.tenantConfig.findUnique({
        where: { collegeId }
      });

      if (config) {
        // License status enforcement (bypass for SUPER_ADMIN or Dev Portal management endpoints)
        const isDevRoute = req.originalUrl && (
          req.originalUrl.includes('/dev') || 
          req.originalUrl.includes('/tenant') ||
          req.originalUrl.startsWith('/api/admin/dev')
        );

        const isDeveloper = req.user && (
          req.user.role === 'SUPER_ADMIN' ||
          (req.user.email && ['developer@mghal.com', 'm.gh.alosimi@gmail.com'].includes(req.user.email.toLowerCase()))
        );

        if (!config.isLicenseActive && !isDeveloper && !isDevRoute) {
          return res.status(403).json({ success: false, error: 'LICENSE_REVOKED' });
        }
        
        // If override URL exists, dynamically route database context
        if (config.databaseUrlOverride) {
          const tenantClient = getTenantPrisma(config.databaseUrlOverride);
          return tenantDbStorage.run(tenantClient, next);
        }
      }
    } catch (err) {
      console.error('[TenantDB Middleware] Failed to resolve tenant DB override:', err.message);
    }
  }

  // Fallback to primary database pool
  return tenantDbStorage.run(null, next);
}

module.exports = { tenantDbMiddleware };
