const { AsyncLocalStorage } = require('async_hooks');
const auditStore = new AsyncLocalStorage();

/**
 * Express Middleware that initializes AsyncLocalStorage for the current request.
 */
function auditContextMiddleware(req, res, next) {
  const context = {
    userEmail: req.user?.email || 'SYSTEM',
    userId: req.user?.id || null,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
    device: req.headers['user-agent'] || 'UNKNOWN'
  };

  auditStore.run(context, () => {
    next();
  });
}

/**
 * Gets current request audit context.
 */
function getAuditContext() {
  return auditStore.getStore() || {
    userEmail: 'SYSTEM',
    userId: null,
    ipAddress: '127.0.0.1',
    device: 'SERVER'
  };
}

/**
 * Writes an immutable AuditLog record to the database asynchronously.
 */
async function recordAuditLog({ action, entity, entityId, beforeJson, afterJson, reqContext }) {
  // Prevent recursive audit logging on AuditLog model
  if (entity === 'AuditLog' || entity === 'SessionLog' || entity === 'NotificationLog') {
    return;
  }

  const context = reqContext || getAuditContext();

  try {
    const { prismaRaw } = require('../db');
    if (!prismaRaw) return;

    const parsedEntityId = entityId ? parseInt(entityId) || null : null;

    await prismaRaw.auditLog.create({
      data: {
        action: action.toUpperCase(),
        entityType: entity,
        entityId: parsedEntityId,
        userEmail: context.userEmail || 'SYSTEM',
        ipAddress: String(context.ipAddress || '127.0.0.1'),
        details: {
          beforeJson: beforeJson || null,
          afterJson: afterJson || null,
          device: context.device || 'SERVER',
          entity,
          entityId: String(entityId || '')
        }
      }
    });
  } catch (err) {
    console.warn(`[AuditService] Failed to record audit log for ${entity} (${action}):`, err.message);
  }
}

module.exports = {
  auditContextMiddleware,
  getAuditContext,
  recordAuditLog,
  auditStore
};
