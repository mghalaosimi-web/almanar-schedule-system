const express = require('express');
const { prisma } = require('../db');
const { verifyToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/audit-logs
 * Retrieves full database audit logs with entity, action, user, and pagination filtering.
 * Guarded by requirePermission('VIEW_SYSTEM_LOGS')
 */
router.get('/audit-logs', verifyToken, requirePermission('VIEW_SYSTEM_LOGS'), async (req, res) => {
  try {
    const { entity, action, userEmail, page = 1, limit = 20 } = req.query;

    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (p - 1) * l;

    const whereClause = {};

    if (entity && entity !== 'ALL') {
      whereClause.entityType = { equals: String(entity), mode: 'insensitive' };
    }

    if (action && action !== 'ALL') {
      whereClause.action = { equals: String(action).toUpperCase() };
    }

    if (userEmail) {
      whereClause.userEmail = { contains: String(userEmail), mode: 'insensitive' };
    }

    const [logs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        skip,
        take: l
      }),
      prisma.auditLog.count({ where: whereClause })
    ]);

    // Format logs for structured UI consumption with before/after diff highlights
    const formattedLogs = logs.map(log => {
      const details = log.details || {};
      return {
        id: log.id,
        action: log.action,
        entity: log.entityType,
        entityId: log.entityId || details.entityId || null,
        userEmail: log.userEmail,
        ipAddress: log.ipAddress,
        device: details.device || 'SERVER',
        timestamp: log.timestamp,
        beforeJson: details.beforeJson || null,
        afterJson: details.afterJson || null
      };
    });

    res.status(200).json({
      success: true,
      data: formattedLogs,
      pagination: {
        page: p,
        limit: l,
        totalCount,
        totalPages: Math.ceil(totalCount / l)
      }
    });

  } catch (error) {
    console.error('[API] Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database audit logs'
    });
  }
});

module.exports = router;
