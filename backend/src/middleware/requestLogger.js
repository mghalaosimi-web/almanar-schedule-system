const recentRequests = [];
const MAX_REQUESTS = 100;
let adminSseClients = [];

function requestLoggerMiddleware(req, res, next) {
  // Exclude assets, static files, and the request stream itself
  if (
    req.path.includes('/admin/dev/request-stream') || 
    req.path.endsWith('.png') || 
    req.path.endsWith('.jpg') || 
    req.path.endsWith('.ico') ||
    req.path.endsWith('.js') ||
    req.path.endsWith('.css')
  ) {
    return next();
  }

  const start = process.hrtime();
  
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const latencyMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    
    // Fallback parser for user email from token if mounted early
    const email = req.user?.email || 'Anonymous';

    const requestData = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latency: latencyMs,
      ip: ipAddress,
      user: email,
      timestamp: new Date()
    };

    recentRequests.unshift(requestData);
    if (recentRequests.length > MAX_REQUESTS) {
      recentRequests.pop();
    }

    // Push to connected admins
    adminSseClients.forEach(client => {
      try {
        client.res.write(`data: ${JSON.stringify(requestData)}\n\n`);
      } catch (_) {}
    });
  });

  next();
}

function getRecentRequests() {
  return recentRequests;
}

function registerAdminSse(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  adminSseClients.push(newClient);

  req.on('close', () => {
    adminSseClients = adminSseClients.filter(c => c.id !== clientId);
  });
}

module.exports = {
  requestLoggerMiddleware,
  getRecentRequests,
  registerAdminSse
};
