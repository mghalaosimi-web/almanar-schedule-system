const jwt = require('jsonwebtoken');

async function tenantDbMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
      } catch (err) {
        // Token validation handled by route guards
      }
    }
  }
  return next();
}

module.exports = { tenantDbMiddleware };
