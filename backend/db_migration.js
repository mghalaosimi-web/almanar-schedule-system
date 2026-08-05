/**
 * db_migration.js — الإصدار النهائي
 * PostgreSQL قاعدة: ALTER TYPE ADD VALUE يجب أن يعمل خارج أي transaction
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helper: run a query, log errors but continue
async function safeQuery(client, sql, params, label) {
  try {
    const res = await client.query(sql, params);
    if (label) console.log(`  ✅ ${label}`);
    return res;
  } catch (err) {
    // Ignore "already exists" errors
    if (err.code === '42P07' || err.code === '42710' || err.code === '42701' ||
        err.message.includes('already exists') || err.message.includes('duplicate')) {
      if (label) console.log(`  ℹ️  ${label} (already exists)`);
      return null;
    }
    console.error(`  ❌ Failed: ${label || sql.substring(0, 60)}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function runMigration() {
  console.log('🚀 Starting database migration...\n');

  // ─── PHASE 1: Enum changes (must run OUTSIDE any transaction) ────────────
  console.log('📌 Phase 1: Adding enum values (no transaction)...');
  const enumClient = await pool.connect();
  try {
    // AdminRole enum values
    const adminEnumValues = ['SUPER_ADMIN', 'UNI_ADMIN', 'COLLEGE_ADMIN'];
    for (const val of adminEnumValues) {
      try {
        await enumClient.query(`ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS '${val}'`);
        console.log(`  ✅ AdminRole.${val} added`);
      } catch (e) {
        if (e.message.includes('already exists') || e.message.includes('duplicate')) {
          console.log(`  ℹ️  AdminRole.${val} already exists`);
        } else {
          console.error(`  ⚠️  AdminRole.${val}: ${e.message}`);
        }
      }
    }

    // PostCategory POLL enum value
    try {
      await enumClient.query(`ALTER TYPE "PostCategory" ADD VALUE IF NOT EXISTS 'POLL'`);
      console.log('  ✅ PostCategory.POLL added');
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('duplicate')) {
        console.log('  ℹ️  PostCategory.POLL already exists');
      } else {
        console.error(`  ⚠️  PostCategory.POLL: ${e.message}`);
      }
    }

    // GoalType enum (create if doesn't exist)
    try {
      await enumClient.query(`CREATE TYPE "GoalType" AS ENUM ('ASSIGNMENT', 'PROJECT', 'EXAM', 'ACHIEVEMENT')`);
      console.log('  ✅ GoalType enum created');
    } catch (e) {
      console.log('  ℹ️  GoalType enum already exists');
    }

    console.log('✅ Phase 1 complete!\n');
  } finally {
    enumClient.release();
  }

  // ─── PHASE 2: Main schema changes (inside one transaction) ───────────────
  console.log('📌 Phase 2: Creating tables and adding columns...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Governorate table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS "Governorate" (
        "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
        "name" TEXT NOT NULL,
        CONSTRAINT "Governorate_pkey" PRIMARY KEY ("id")
      )`, null, 'Governorate table');
    await safeQuery(client, `CREATE UNIQUE INDEX IF NOT EXISTS "Governorate_name_key" ON "Governorate"("name")`, null, null);

    // 2. University table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS "University" (
        "id" SERIAL NOT NULL,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "logoUrl" TEXT,
        "themeColor" TEXT,
        "governorateId" TEXT,
        CONSTRAINT "University_pkey" PRIMARY KEY ("id")
      )`, null, 'University table');
    await safeQuery(client, `CREATE UNIQUE INDEX IF NOT EXISTS "University_slug_key" ON "University"("slug")`, null, null);
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "University_governorateId_idx" ON "University"("governorateId")`, null, null);

    // 3. College table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS "College" (
        "id" SERIAL NOT NULL,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "location" TEXT,
        "universityId" INTEGER NOT NULL,
        CONSTRAINT "College_pkey" PRIMARY KEY ("id")
      )`, null, 'College table');
    await safeQuery(client, `CREATE UNIQUE INDEX IF NOT EXISTS "College_slug_key" ON "College"("slug")`, null, null);
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "College_universityId_idx" ON "College"("universityId")`, null, null);

    // 4. TenantConfig table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS "TenantConfig" (
        "id" SERIAL NOT NULL,
        "universityId" INTEGER,
        "collegeId" INTEGER,
        "themeColor" TEXT,
        "logoUrl" TEXT,
        "customDomain" TEXT,
        "enabledFeatures" JSONB NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TenantConfig_pkey" PRIMARY KEY ("id")
      )`, null, 'TenantConfig table');
    await safeQuery(client, `CREATE UNIQUE INDEX IF NOT EXISTS "TenantConfig_universityId_key" ON "TenantConfig"("universityId")`, null, null);
    await safeQuery(client, `CREATE UNIQUE INDEX IF NOT EXISTS "TenantConfig_collegeId_key" ON "TenantConfig"("collegeId")`, null, null);

    // 5. AuditLog
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" SERIAL NOT NULL,
        "action" TEXT NOT NULL,
        "entityType" TEXT NOT NULL,
        "entityId" INTEGER,
        "userEmail" TEXT NOT NULL,
        "ipAddress" TEXT NOT NULL,
        "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "details" JSONB NOT NULL,
        CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
      )`, null, 'AuditLog table');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "AuditLog_timestamp_idx" ON "AuditLog"("timestamp")`, null, null);
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "AuditLog_userEmail_idx" ON "AuditLog"("userEmail")`, null, null);

    // 6. SessionLog
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS "SessionLog" (
        "id" SERIAL NOT NULL,
        "userEmail" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "logoutTime" TIMESTAMP,
        "devicePlatform" TEXT,
        "ipAddress" TEXT NOT NULL DEFAULT 'unknown',
        "status" TEXT NOT NULL DEFAULT 'SUCCESS',
        "isRevoked" BOOLEAN NOT NULL DEFAULT false,
        "userAgent" TEXT,
        "deviceOs" TEXT,
        "browser" TEXT,
        "appVersion" TEXT,
        "country" TEXT,
        CONSTRAINT "SessionLog_pkey" PRIMARY KEY ("id")
      )`, null, 'SessionLog table');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "SessionLog_userEmail_idx" ON "SessionLog"("userEmail")`, null, null);
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "SessionLog_loginTime_idx" ON "SessionLog"("loginTime")`, null, null);

    // 7. InsightLog
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS "InsightLog" (
        "id" SERIAL NOT NULL,
        "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "category" TEXT NOT NULL,
        "severity" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "data" JSONB,
        CONSTRAINT "InsightLog_pkey" PRIMARY KEY ("id")
      )`, null, 'InsightLog table');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "InsightLog_generatedAt_idx" ON "InsightLog"("generatedAt")`, null, null);

    // 8. BlockedIP
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS "BlockedIP" (
        "id" SERIAL NOT NULL,
        "ip" TEXT NOT NULL,
        "reason" TEXT,
        "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BlockedIP_pkey" PRIMARY KEY ("id")
      )`, null, 'BlockedIP table');
    await safeQuery(client, `CREATE UNIQUE INDEX IF NOT EXISTS "BlockedIP_ip_key" ON "BlockedIP"("ip")`, null, null);
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "BlockedIP_ip_idx" ON "BlockedIP"("ip")`, null, null);

    // 9. StudentTask
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS "StudentTask" (
        "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
        "studentId" INTEGER NOT NULL,
        "title" TEXT NOT NULL,
        "dueDate" TIMESTAMP,
        "completed" BOOLEAN NOT NULL DEFAULT false,
        "category" TEXT NOT NULL DEFAULT 'PERSONAL',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StudentTask_pkey" PRIMARY KEY ("id")
      )`, null, 'StudentTask table');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "StudentTask_studentId_idx" ON "StudentTask"("studentId")`, null, null);

    // 10. Poll
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS "Poll" (
        "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
        "question" TEXT NOT NULL,
        "options" TEXT[] NOT NULL DEFAULT '{}',
        "postId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
      )`, null, 'Poll table');
    await safeQuery(client, `CREATE UNIQUE INDEX IF NOT EXISTS "Poll_postId_key" ON "Poll"("postId")`, null, null);

    // 11. PollVote
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS "PollVote" (
        "id" SERIAL NOT NULL,
        "pollId" TEXT NOT NULL,
        "studentId" INTEGER NOT NULL,
        "optionIdx" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
      )`, null, 'PollVote table');
    await safeQuery(client, `CREATE UNIQUE INDEX IF NOT EXISTS "PollVote_pollId_studentId_key" ON "PollVote"("pollId", "studentId")`, null, null);

    // 12. AcademicGoal
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS "AcademicGoal" (
        "id" SERIAL NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "type" "GoalType" NOT NULL DEFAULT 'ASSIGNMENT',
        "dueDate" TIMESTAMP,
        "weekNumber" INTEGER,
        "subjectId" INTEGER NOT NULL,
        "groupId" INTEGER,
        "scheduleId" INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AcademicGoal_pkey" PRIMARY KEY ("id")
      )`, null, 'AcademicGoal table');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "AcademicGoal_subjectId_idx" ON "AcademicGoal"("subjectId")`, null, null);
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "AcademicGoal_groupId_idx" ON "AcademicGoal"("groupId")`, null, null);
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "AcademicGoal_scheduleId_idx" ON "AcademicGoal"("scheduleId")`, null, null);

    // 13. StudentGoalCompletion
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS "StudentGoalCompletion" (
        "id" SERIAL NOT NULL,
        "studentId" INTEGER NOT NULL,
        "academicGoalId" INTEGER NOT NULL,
        "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "status" TEXT NOT NULL DEFAULT 'COMPLETED',
        CONSTRAINT "StudentGoalCompletion_pkey" PRIMARY KEY ("id")
      )`, null, 'StudentGoalCompletion table');
    await safeQuery(client, `CREATE UNIQUE INDEX IF NOT EXISTS "StudentGoalCompletion_studentId_academicGoalId_key" ON "StudentGoalCompletion"("studentId", "academicGoalId")`, null, null);
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "StudentGoalCompletion_studentId_idx" ON "StudentGoalCompletion"("studentId")`, null, null);
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "StudentGoalCompletion_academicGoalId_idx" ON "StudentGoalCompletion"("academicGoalId")`, null, null);

    console.log('\n🔧 Adding missing columns to existing tables...');

    // Add collegeId to core tables
    const tablesNeedingCollegeId = ['Student','Lecturer','Group','Schedule','Subject','Room','ExamSchedule','Department'];
    for (const t of tablesNeedingCollegeId) {
      await safeQuery(client, `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "collegeId" INTEGER`, null, `${t}.collegeId column`);
      await safeQuery(client, `CREATE INDEX IF NOT EXISTS "${t}_collegeId_idx" ON "${t}"("collegeId")`, null, null);
    }

    // Add universityId + collegeId to Admin
    await safeQuery(client, `ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "universityId" INTEGER`, null, 'Admin.universityId');
    await safeQuery(client, `ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "collegeId" INTEGER`, null, 'Admin.collegeId');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "Admin_universityId_idx" ON "Admin"("universityId")`, null, null);
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "Admin_collegeId_idx" ON "Admin"("collegeId")`, null, null);

    // Add gamification columns to Student
    await safeQuery(client, `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "xp" INTEGER NOT NULL DEFAULT 350`, null, 'Student.xp');
    await safeQuery(client, `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "streak" INTEGER NOT NULL DEFAULT 7`, null, 'Student.streak');
    await safeQuery(client, `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "lastLoginDate" TIMESTAMP`, null, 'Student.lastLoginDate');
    await safeQuery(client, `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "isFocusing" BOOLEAN NOT NULL DEFAULT false`, null, 'Student.isFocusing');

    // Add missing NotificationLog columns
    await safeQuery(client, `ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "title" TEXT`, null, 'NotificationLog.title');
    await safeQuery(client, `ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP`, null, 'NotificationLog.deliveredAt');
    await safeQuery(client, `ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP`, null, 'NotificationLog.readAt');
    await safeQuery(client, `ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "deviceToken" TEXT`, null, 'NotificationLog.deviceToken');
    await safeQuery(client, `ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "platform" TEXT`, null, 'NotificationLog.platform');
    await safeQuery(client, `ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "broadcastId" TEXT`, null, 'NotificationLog.broadcastId');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "NotificationLog_status_idx" ON "NotificationLog"("status")`, null, null);
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS "NotificationLog_broadcastId_idx" ON "NotificationLog"("broadcastId")`, null, null);

    // Add missing ExchangePost/Comment columns
    await safeQuery(client, `ALTER TABLE "ExchangePost" ADD COLUMN IF NOT EXISTS "isAnonymous" BOOLEAN NOT NULL DEFAULT false`, null, 'ExchangePost.isAnonymous');
    await safeQuery(client, `ALTER TABLE "ExchangeComment" ADD COLUMN IF NOT EXISTS "isAnonymous" BOOLEAN NOT NULL DEFAULT false`, null, 'ExchangeComment.isAnonymous');
    await safeQuery(client, `ALTER TABLE "ExchangeComment" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false`, null, 'ExchangeComment.isVerified');

    await client.query('COMMIT');
    console.log('\n✅ Phase 2 complete!\n');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('❌ Phase 2 failed! Rolled back.');
    throw err;
  } finally {
    client.release();
  }

  // ─── PHASE 3: Seed data + update enum values ─────────────────────────────
  console.log('📌 Phase 3: Seeding Al-Manar data...');
  const seedClient = await pool.connect();
  try {
    await seedClient.query('BEGIN');

    // Seed Governorate
    const govRes = await seedClient.query(
      "INSERT INTO \"Governorate\" (name) VALUES ('صنعاء') ON CONFLICT (name) DO UPDATE SET name='صنعاء' RETURNING id"
    );
    const govId = govRes.rows[0].id;
    console.log(`  ✅ Governorate: صنعاء (id: ${govId})`);

    // Seed University
    const uniRes = await seedClient.query(
      `INSERT INTO "University" (name, slug, "themeColor", "governorateId") 
       VALUES ('كلية المنار الجامعية', 'almanar-college', '#84cc16', $1)
       ON CONFLICT (slug) DO UPDATE SET name='كلية المنار الجامعية' RETURNING id`,
      [govId]
    );
    const uniId = uniRes.rows[0].id;
    console.log(`  ✅ University: كلية المنار (id: ${uniId})`);

    // Seed College
    const colRes = await seedClient.query(
      `INSERT INTO "College" (name, slug, "universityId") 
       VALUES ('كلية المنار الجامعية', 'almanar-main', $1)
       ON CONFLICT (slug) DO UPDATE SET name='كلية المنار الجامعية' RETURNING id`,
      [uniId]
    );
    const colId = colRes.rows[0].id;
    console.log(`  ✅ College: كلية المنار الجامعية (id: ${colId})`);

    // TenantConfig
    await seedClient.query(
      `INSERT INTO "TenantConfig" ("collegeId", "themeColor", "enabledFeatures", "updatedAt")
       VALUES ($1, '#84cc16', '{"qrAttendance": true, "notifications": true}', NOW())
       ON CONFLICT ("collegeId") DO NOTHING`,
      [colId]
    );
    console.log(`  ✅ TenantConfig for college ${colId}`);

    // Set collegeId = colId for all existing rows
    const tablesUpdate = ['Student','Lecturer','Group','Schedule','Subject','Room','ExamSchedule','Department'];
    for (const t of tablesUpdate) {
      const r = await seedClient.query(`UPDATE "${t}" SET "collegeId" = $1 WHERE "collegeId" IS NULL`, [colId]);
      if (r.rowCount > 0) console.log(`  ✅ Updated ${r.rowCount} rows in ${t}.collegeId = ${colId}`);
    }

    // Fix SUPER_ADMIN role
    const adminUpdate = await seedClient.query(
      `UPDATE "Admin" SET "role" = 'SUPER_ADMIN' WHERE email = 'm.gh.alosimi@gmail.com'`
    );
    console.log(`  ✅ Fixed ${adminUpdate.rowCount} admin(s) to SUPER_ADMIN`);

    await seedClient.query('COMMIT');
    console.log('✅ Phase 3 complete!\n');
  } catch (err) {
    try { await seedClient.query('ROLLBACK'); } catch {}
    console.error('❌ Phase 3 failed! Rolled back.');
    throw err;
  } finally {
    seedClient.release();
  }

  // ─── Final Verification ───────────────────────────────────────────────────
  console.log('📊 Final Verification:');
  const verClient = await pool.connect();
  try {
    const tables = await verClient.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' 
      ORDER BY table_name
    `);
    console.log(`  Total tables: ${tables.rows.length}`);
    
    const criticalTables = ['College', 'University', 'Governorate', 'TenantConfig', 'AuditLog', 'SessionLog', 'BlockedIP', 'Poll', 'PollVote', 'StudentTask', 'AcademicGoal', 'StudentGoalCompletion'];
    for (const t of criticalTables) {
      const found = tables.rows.find(r => r.table_name === t);
      console.log(`  ${found ? '✅' : '❌'} ${t}`);
    }

    const admins = await verClient.query('SELECT id, name, email, role FROM "Admin"');
    console.log('\n👤 Admin accounts:');
    admins.rows.forEach(a => console.log(`  - [${a.role}] ${a.name} <${a.email}>`));

    const stats = await verClient.query(`
      SELECT 
        (SELECT COUNT(*) FROM "Student") as students,
        (SELECT COUNT(*) FROM "Schedule") as schedules,
        (SELECT COUNT(*) FROM "Lecturer") as lecturers,
        (SELECT COUNT(*) FROM "Group") as groups
    `);
    const s = stats.rows[0];
    console.log(`\n📊 Data: ${s.students} students | ${s.schedules} schedules | ${s.lecturers} lecturers | ${s.groups} groups`);

  } finally {
    verClient.release();
    await pool.end();
  }

  console.log('\n🎉 All migrations completed successfully!');
}

runMigration().catch(err => {
  console.error('💥 Fatal migration error:', err.message);
  process.exit(1);
});
