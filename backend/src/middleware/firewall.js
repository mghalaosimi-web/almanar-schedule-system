const { prisma } = require('../db');

// In-memory cache of blocked IPs
let blockedIpsCache = new Set();
let isInitialized = false;

let initPromise = null;

// Initialize cache from database
async function initializeFirewall() {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const list = await prisma.blockedIP.findMany({ select: { ip: true } });
        blockedIpsCache = new Set(list.map(item => item.ip));
        isInitialized = true;
        console.log(`[FIREWALL] Initialized with ${blockedIpsCache.size} blocked IPs.`);
      } catch (error) {
        console.error('[FIREWALL] Initialization error:', error.message);
        // Delay resetting initPromise by 30 seconds to prevent connection storms
        setTimeout(() => {
          initPromise = null;
        }, 30000);
      }
    })();
  }
  return initPromise;
}

// Middleware function
async function firewallMiddleware(req, res, next) {
  if (!isInitialized) {
    // Run initialization in background without awaiting to prevent request blocking
    initializeFirewall().catch(err => {
      console.error('[FIREWALL] Background initialization failed:', err.message);
    });
  }

  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  // Normalize IP
  let cleanIp = ipAddress;
  if (cleanIp === '::1' || cleanIp === '::ffff:127.0.0.1') {
    cleanIp = '127.0.0.1';
  }

  if (blockedIpsCache.has(cleanIp)) {
    console.warn(`[FIREWALL] Blocked request from IP: ${cleanIp}`);
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Your IP address has been blocked by the system administrator.',
      code: 'IP_BLOCKED'
    });
  }

  next();
}

// Helper methods to update cache when admin modifies firewall rules
function addBlockedIpToCache(ip) {
  let clean = ip;
  if (clean === '::1' || clean === '::ffff:127.0.0.1') {
    clean = '127.0.0.1';
  }
  blockedIpsCache.add(clean);
}

// Helper methods to remove blocked IP from cache
function removeBlockedIpFromCache(ip) {
  let clean = ip;
  if (clean === '::1' || clean === '::ffff:127.0.0.1') {
    clean = '127.0.0.1';
  }
  blockedIpsCache.delete(clean);
}

module.exports = {
  firewallMiddleware,
  initializeFirewall,
  addBlockedIpToCache,
  removeBlockedIpFromCache
};
