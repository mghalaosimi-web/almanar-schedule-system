const { getSseClients } = require('./notifications');
const { prisma } = require('../db');

// In-memory data structures (fallback / runtime telemetry)
const activityLogs = [];
const activeAPIUsers = new Map(); // key: "id-role", value: { id, name, email, role, lastActive }

const MAX_LOGS = 100;

function pushLog(name, email, role, action, details = '') {
  activityLogs.unshift({
    id: `${Date.now()}-${Math.random()}`,
    name,
    email,
    role,
    action,
    details,
    timestamp: new Date()
  });

  if (activityLogs.length > MAX_LOGS) {
    activityLogs.pop();
  }
}

async function recordLogin(user, role, ipAddress = 'unknown', status = 'SUCCESS', devicePlatform = 'Web/Desktop') {
  if (!user) return;
  
  // 1. In-memory
  pushLog(user.name, user.email, role || user.role, 'LOGIN');
  keepAlive(user, role);

  // Parse User-Agent using ua-parser-js
  const { UAParser } = require('ua-parser-js');
  let osName = 'Web/Desktop';
  let browserName = 'Unknown';
  let userAgentFull = devicePlatform || '';
  
  if (devicePlatform && devicePlatform.includes('Mozilla')) {
    try {
      const parser = new UAParser(devicePlatform);
      const parsed = parser.getResult();
      osName = parsed.os.name || 'Web/Desktop';
      browserName = parsed.browser.name || 'Unknown';
    } catch (uaErr) {
      console.warn('[SessionTracker] UA parse error:', uaErr.message);
    }
  } else {
    if (devicePlatform && ['Android', 'iOS', 'Web'].includes(devicePlatform)) {
      osName = devicePlatform;
    }
  }

  // 2. Database
  try {
    const session = await prisma.sessionLog.create({
      data: {
        userEmail: user.email || 'unknown',
        role: role || user.role || 'STUDENT',
        loginTime: new Date(),
        logoutTime: null,
        devicePlatform: devicePlatform ? devicePlatform.substring(0, 200) : 'Web/Desktop',
        ipAddress: ipAddress || 'unknown',
        status,
        isRevoked: false,
        userAgent: userAgentFull.substring(0, 500),
        deviceOs: osName,
        browser: browserName,
        appVersion: '3.5.0',
        country: 'YE'
      }
    });
    return session.id;
  } catch (err) {
    console.error('[SessionTracker] DB Login log error:', err.message);
  }
}

async function recordLogout(user, role, ipAddress = 'unknown') {
  if (!user) return;

  // 1. In-memory
  pushLog(user.name, user.email, role || user.role, 'LOGOUT');
  activeAPIUsers.delete(`${user.id}-${role || user.role}`);

  // 2. Database
  try {
    const lastSession = await prisma.sessionLog.findFirst({
      where: { userEmail: user.email, status: 'SUCCESS', logoutTime: null },
      orderBy: { loginTime: 'desc' }
    });
    if (lastSession) {
      await prisma.sessionLog.update({
        where: { id: lastSession.id },
        data: { logoutTime: new Date() }
      });
    }
  } catch (err) {
    console.error('[SessionTracker] DB Logout log error:', err.message);
  }
}

async function recordAuditLog(action, entityType, entityId, userEmail, ipAddress, details) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId: entityId ? parseInt(entityId) : null,
        userEmail: userEmail || 'system',
        ipAddress: ipAddress || '127.0.0.1',
        details: details || {}
      }
    });
  } catch (err) {
    console.error('[SessionTracker] DB AuditLog error:', err.message);
  }
}

function recordImpersonate(adminName, adminEmail, targetName, targetEmail, targetRole) {
  pushLog(
    adminName,
    adminEmail,
    'SUPER_ADMIN',
    'IMPERSONATE',
    `Impersonating ${targetName} (${targetRole} - ${targetEmail})`
  );
}

function keepAlive(user, role) {
  if (!user || !user.id) return;
  const userRole = role || user.role;
  const key = `${user.id}-${userRole}`;
  activeAPIUsers.set(key, {
    id: user.id,
    name: user.name,
    email: user.email || '',
    role: userRole,
    lastActive: new Date()
  });
}

function getOnlineUsers() {
  const onlineMap = new Map(); // key: "id-role"
  const now = new Date();
  const FIVE_MINUTES = 5 * 60 * 1000;

  // 1. Add active SSE clients
  try {
    const sseClients = getSseClients() || [];
    sseClients.forEach(client => {
      if (client.user && client.user.id) {
        const u = client.user;
        const key = `${u.id}-${u.role}`;
        onlineMap.set(key, {
          id: u.id,
          name: u.name,
          email: u.email || '',
          role: u.role,
          source: 'SSE_STREAM',
          lastActive: new Date()
        });
      }
    });
  } catch (err) {
    console.error('[SessionTracker] Error reading sse clients:', err.message);
  }

  // 2. Add users active via API calls in the last 5 minutes
  activeAPIUsers.forEach((value, key) => {
    if (now - value.lastActive < FIVE_MINUTES) {
      if (!onlineMap.has(key)) {
        onlineMap.set(key, {
          ...value,
          source: 'API_ACTIVITY'
        });
      } else {
        // SSE exists, but let's preserve the latest timestamp
        const existing = onlineMap.get(key);
        if (value.lastActive > existing.lastActive) {
          existing.lastActive = value.lastActive;
        }
      }
    } else {
      // Clean up stale API users
      activeAPIUsers.delete(key);
    }
  });

  return Array.from(onlineMap.values());
}

function getActivityLogs() {
  try {
    const fs = require('fs');
    const path = require('path');
    const logsFile = path.join(__dirname, '../../logs/activity.log');
    if (!fs.existsSync(logsFile)) {
      return [];
    }
    const fileContent = fs.readFileSync(logsFile, 'utf8');
    return fileContent
      .trim()
      .split('\n')
      .reverse()
      .slice(0, 100)
      .map((line, index) => {
        const parts = line.split(' | ');
        const isoTime = parts[0];
        const message = parts[1] || line;

        let action = 'ACTIVITY';
        let role = 'SYSTEM';

        if (message.includes('[تسجيل جديد]')) {
          action = 'LOGIN';
          role = 'STUDENT';
        } else if (message.includes('[حضور')) {
          action = 'LOGIN';
          role = 'STUDENT';
        } else if (message.includes('[منتدى')) {
          action = 'IMPERSONATE';
          role = 'STUDENT';
        } else if (message.includes('[تسجيل دخول]')) {
          action = 'LOGIN';
        } else if (message.includes('[إكمال ملف]')) {
          action = 'LOGIN';
        }

        return {
          id: `file-log-${index}`,
          name: 'سجل نشاط النظام',
          email: 'activity.log',
          role,
          action,
          details: message,
          timestamp: isoTime ? new Date(isoTime) : new Date()
        };
      });
  } catch (err) {
    console.error('[SessionTracker] Failed to read activity logs from file:', err.message);
    return [];
  }
}

module.exports = {
  recordLogin,
  recordLogout,
  recordImpersonate,
  recordAuditLog,
  keepAlive,
  getOnlineUsers,
  getActivityLogs
};

