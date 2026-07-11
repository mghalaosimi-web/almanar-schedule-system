const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
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
    
    // Check if college is deactivated (exclude SUPER_ADMIN)
    if (decoded.role !== 'SUPER_ADMIN' && decoded.collegeId) {
      const systemSettings = require('../services/systemSettings');
      const deactivated = systemSettings.get('deactivatedColleges') || [];
      if (deactivated.includes(parseInt(decoded.collegeId))) {
        return res.status(403).json({ success: false, error: 'LICENSE_REVOKED' });
      }
    }

    // Enforce Google SSO at Backend Level
    if (decoded.role === 'STUDENT' && !decoded.googleId) {
      const isStudentRoute = req.originalUrl.startsWith('/api/student') || 
                            req.originalUrl.startsWith('/api/rep') || 
                            req.originalUrl.startsWith('/api/exchange') ||
                            req.originalUrl.startsWith('/api/attendance');
      if (isStudentRoute) {
        return res.status(403).json({ success: false, error: 'GOOGLE_LINK_REQUIRED' });
      }
    }

    // Session tracking activity
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

module.exports = { verifyToken, verifyAdmin };
