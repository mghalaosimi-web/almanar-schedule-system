const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { getGlobalPrisma, cleanupTenantPrisma } = require('../utils/dbFactory');

/**
 * Controller for Developer Portal Tasks
 */

exports.generateTenantKey = async (req, res) => {
  const prisma = getGlobalPrisma();
  try {
    const { collegeId, universityId } = req.body;
    const whitelabelKey = crypto.randomBytes(32).toString('hex');

    let whereClause = {};
    if (collegeId) whereClause.collegeId = parseInt(collegeId);
    else if (universityId) whereClause.universityId = parseInt(universityId);
    else return res.status(400).json({ success: false, error: 'Must provide collegeId or universityId' });

    let config = await prisma.tenantConfig.findFirst({ where: whereClause });
    if (!config) {
      config = await prisma.tenantConfig.create({
        data: { ...whereClause, whitelabelKey }
      });
    } else {
      config = await prisma.tenantConfig.update({
        where: { id: config.id },
        data: { whitelabelKey }
      });
    }
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('[Controller] Generate tenant key error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate key: ' + error.message });
  }
};

exports.injectAndValidateDB = async (req, res) => {
  const prisma = getGlobalPrisma();
  try {
    const { tenantConfigId, databaseUrlOverride } = req.body;
    if (!tenantConfigId) return res.status(400).json({ success: false, error: 'tenantConfigId is required' });

    // 1. Pre-flight Validation
    if (databaseUrlOverride) {
      let temporaryClient;
      try {
        temporaryClient = new PrismaClient({
          datasources: { db: { url: databaseUrlOverride } },
        });
        
        // Execute a lightweight test query
        await temporaryClient.$queryRaw`SELECT 1`;
        
        // Success, gracefully disconnect
        await temporaryClient.$disconnect();
      } catch (dbError) {
        if (temporaryClient) {
          try { await temporaryClient.$disconnect(); } catch (e) {}
        }
        console.error('[Controller] Pre-flight DB validation failed:', dbError);
        return res.status(422).json({ 
          success: false, 
          error: 'Invalid database connection string. Pre-flight query failed.',
          details: dbError.message
        });
      }
    }

    // 2. Clear old cache if overriding or removing
    const existingConfig = await prisma.tenantConfig.findUnique({ where: { id: tenantConfigId } });
    if (existingConfig && existingConfig.databaseUrlOverride) {
      await cleanupTenantPrisma(existingConfig.databaseUrlOverride);
    }

    // 3. Persist new DB string
    const config = await prisma.tenantConfig.update({
      where: { id: tenantConfigId },
      data: { databaseUrlOverride }
    });
    
    res.json({ success: true, data: config, message: 'Database connection validated and injected successfully.' });
  } catch (error) {
    console.error('[Controller] Inject DB string error:', error);
    res.status(500).json({ success: false, error: 'Failed to inject DB string: ' + error.message });
  }
};

exports.toggleLicenseAndKillSessions = async (req, res) => {
  const prisma = getGlobalPrisma();
  try {
    const { tenantConfigId, isLicenseActive } = req.body;
    if (!tenantConfigId) return res.status(400).json({ success: false, error: 'tenantConfigId is required' });

    const config = await prisma.tenantConfig.update({
      where: { id: tenantConfigId },
      data: { isLicenseActive }
    });

    // CASCADE EFFECT: If revoked, atomically purge ALL session logs for this college
    // Uses a single raw SQL DELETE with a UNION subquery — eliminates N+1 pattern and race windows.
    // SessionLog has no collegeId column (schema-verified), so we resolve via email join.
    if (!isLicenseActive && config.collegeId) {
      const targetCollegeId = config.collegeId;

      await prisma.$executeRaw`
        DELETE FROM "SessionLog"
        WHERE "userEmail" IN (
          SELECT email FROM "Student"  WHERE "collegeId" = ${targetCollegeId}
          UNION ALL
          SELECT email FROM "Lecturer" WHERE "collegeId" = ${targetCollegeId}
          UNION ALL
          SELECT email FROM "Admin"    WHERE "collegeId" = ${targetCollegeId} AND "role" != 'SUPER_ADMIN' AND email NOT IN ('developer@mghal.com', 'm.gh.alosimi@gmail.com')
        )
      `;
    }

    res.json({ success: true, data: config, message: 'License state updated and sessions cascaded.' });
  } catch (error) {
    console.error('[Controller] Toggle license error:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle license: ' + error.message });
  }
};

