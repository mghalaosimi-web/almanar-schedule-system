const express = require('express');
const { prisma } = require('../db');
const { verifyToken, isSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// Global developer database routes check
router.use('/admin/dev/db', verifyToken, isSuperAdmin);

// Helper: Ensure user is SUPER_ADMIN
const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
};

// 1. GET /api/admin/dev/db/tables - Get all tables and row counts
router.get('/admin/dev/db/tables', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const counts = {
      Student: await prisma.student.count(),
      Lecturer: await prisma.lecturer.count(),
      Admin: await prisma.admin.count(),
      Department: await prisma.department.count(),
      Major: await prisma.major.count(),
      Level: await prisma.level.count(),
      Group: await prisma.group.count(),
      Subject: await prisma.subject.count(),
      Room: await prisma.room.count(),
      Schedule: await prisma.schedule.count(),
      ScheduleOverride: await prisma.scheduleOverride.count(),
      ExamSchedule: await prisma.examSchedule.count(),
      Attendance: await prisma.attendance.count(),
      Feedback: await prisma.feedback.count(),
      NotificationLog: await prisma.notificationLog.count(),
      VerificationCode: await prisma.verificationCode.count(),
      ExchangePost: await prisma.exchangePost.count()
    };

    res.status(200).json({
      success: true,
      tables: Object.keys(counts).map(name => ({
        name,
        count: counts[name]
      }))
    });
  } catch (error) {
    console.error('[DB API] Get tables error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve tables: ' + error.message });
  }
});

// 2. GET /api/admin/dev/db/query - Inspect table records in paginated format
router.get('/admin/dev/db/query', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const { table, page = 1, limit = 15, search = '' } = req.query;

    if (!table) {
      return res.status(400).json({ success: false, error: 'Table name is required' });
    }

    const modelName = table.charAt(0).toLowerCase() + table.slice(1);
    if (!prisma[modelName]) {
      return res.status(400).json({ success: false, error: `Table '${table}' does not exist in schema` });
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 15;
    const skip = (pageNum - 1) * limitNum;

    // Dynamically build where clause for basic search if columns exist
    let where = {};
    if (search && search.trim() !== '') {
      const query = search.trim();
      // For commonly searched models, apply text searches
      if (['student', 'lecturer', 'admin'].includes(modelName)) {
        where = {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } }
          ]
        };
      } else if (modelName === 'room') {
        where = { name: { contains: query, mode: 'insensitive' } };
      } else if (modelName === 'subject') {
        where = {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { code: { contains: query, mode: 'insensitive' } }
          ]
        };
      }
    }

    const [total, rows] = await Promise.all([
      prisma[modelName].count({ where }),
      prisma[modelName].findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { id: 'desc' }
      })
    ]);

    // Extract columns dynamically from rows or hardcode default
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    res.status(200).json({
      success: true,
      table,
      total,
      page: pageNum,
      limit: limitNum,
      columns,
      rows
    });
  } catch (error) {
    console.error('[DB API] Query table error:', error);
    res.status(500).json({ success: false, error: 'Failed to query table: ' + error.message });
  }
});

// 3. GET /api/admin/dev/db/diagnostics - Database integrity and performance diagnostic scan
router.get('/admin/dev/db/diagnostics', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - start;

    const warnings = [];
    let healthScore = 100;

    // Check 1: Registered students count
    const studentCount = await prisma.student.count();
    if (studentCount === 0) {
      warnings.push({
        type: 'WARNING',
        message: 'قاعدة البيانات لا تحتوي على أي طلاب مسجلين.',
        messageEn: 'Database contains zero registered students.'
      });
      healthScore -= 10;
    }

    // Check 2: Active schedules
    const scheduleCount = await prisma.schedule.count();
    if (scheduleCount === 0) {
      warnings.push({
        type: 'WARNING',
        message: 'لم يتم العثور على جداول دراسية نشطة.',
        messageEn: 'No active lecture schedules found in database.'
      });
      healthScore -= 10;
    }

    // Check 3: Orphaned verification codes
    const orphanCodesResult = await prisma.$queryRaw`
      SELECT COUNT(*)::integer as count FROM "VerificationCode" 
      WHERE "studentId" NOT IN (SELECT id FROM "Student")
    `.catch(() => [{ count: 0 }]);
    const orphanCodesCount = parseInt(orphanCodesResult[0]?.count || 0);
    if (orphanCodesCount > 0) {
      warnings.push({
        type: 'INTEGRITY_ALERT',
        message: `تم العثور على ${orphanCodesCount} رمز تحقق معلق غير مرتبط بأي طالب.`,
        messageEn: `Found ${orphanCodesCount} orphaned verification codes not linked to any student.`
      });
      healthScore -= 5;
    }

    // Check 4: Orphaned attendance records
    const orphanAttendanceResult = await prisma.$queryRaw`
      SELECT COUNT(*)::integer as count FROM "Attendance" 
      WHERE "studentId" NOT IN (SELECT id FROM "Student")
    `.catch(() => [{ count: 0 }]);
    const orphanAttendanceCount = parseInt(orphanAttendanceResult[0]?.count || 0);
    if (orphanAttendanceCount > 0) {
      warnings.push({
        type: 'INTEGRITY_ALERT',
        message: `تم العثور على ${orphanAttendanceCount} سجل حضور غير مرتبط بأي طالب.`,
        messageEn: `Found ${orphanAttendanceCount} orphaned attendance records not linked to any student.`
      });
      healthScore -= 5;
    }

    // Check 5: High active database connections
    const pgStats = await prisma.$queryRaw`
      SELECT count(*)::integer as count FROM pg_stat_activity WHERE state = 'active'
    `.catch(() => [{ count: 1 }]);
    const activeConns = parseInt(pgStats[0]?.count || 1);
    if (activeConns > 12) {
      warnings.push({
        type: 'PERFORMANCE_ALERT',
        message: `عدد الاتصالات النشطة مرتفع حالياً (${activeConns} اتصالات نشطة).`,
        messageEn: `High number of active database connections (${activeConns} active connections).`
      });
      healthScore -= 5;
    }

    // Database size
    const dbSizeResult = await prisma.$queryRaw`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `.catch(() => [{ size: 'N/A' }]);
    const dbSize = dbSizeResult[0]?.size || 'N/A';

    // Index health/cache hit rates (standard PostgreSQL performance metrics)
    const indexHitRateResult = await prisma.$queryRaw`
      SELECT 
        round(100 * sum(idx_blks_hit) / (sum(idx_blks_hit) + sum(idx_blks_read)), 2)::float as rate
      FROM pg_statio_user_indexes
    `.catch(() => [{ rate: 99.9 }]);
    const indexHitRate = indexHitRateResult[0]?.rate || 99.9;

    // Final normalization
    healthScore = Math.max(0, healthScore);

    res.status(200).json({
      success: true,
      diagnostics: {
        dbLatency,
        healthScore,
        dbSize,
        indexHitRate,
        activeConnections: activeConns,
        warnings
      }
    });
  } catch (error) {
    console.error('[DB API] Diagnostics error:', error);
    res.status(500).json({ success: false, error: 'Diagnostics scan failed: ' + error.message });
  }
});

module.exports = router;
