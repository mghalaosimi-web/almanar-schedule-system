process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

async function auditCanonicalIdentity() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('=== CANONICAL IDENTITY READ-ONLY AUDIT ===\n');

  // 1. Profile & User Counts
  const studentRes = await client.query('SELECT COUNT(*) FROM "Student"');
  const lecturerRes = await client.query('SELECT COUNT(*) FROM "Lecturer"');
  const adminRes = await client.query('SELECT COUNT(*) FROM "Admin"');
  const userRes = await client.query('SELECT COUNT(*) FROM "User"');

  const studentCount = parseInt(studentRes.rows[0].count, 10);
  const lecturerCount = parseInt(lecturerRes.rows[0].count, 10);
  const adminCount = parseInt(adminRes.rows[0].count, 10);
  const userCount = parseInt(userRes.rows[0].count, 10);

  console.log(`[Counts] Student: ${studentCount} (Expected: 1005)`);
  console.log(`[Counts] Lecturer: ${lecturerCount} (Expected: 28)`);
  console.log(`[Counts] Admin: ${adminCount} (Expected: 3)`);
  console.log(`[Counts] User: ${userCount} (Expected: 1036)`);

  // 2. FK Linkage Counts
  const studentFkRes = await client.query('SELECT COUNT(*) FROM "Student" WHERE "userId" IS NOT NULL');
  const lecturerFkRes = await client.query('SELECT COUNT(*) FROM "Lecturer" WHERE "userId" IS NOT NULL');
  const adminFkRes = await client.query('SELECT COUNT(*) FROM "Admin" WHERE "userId" IS NOT NULL');

  const studentFkCount = parseInt(studentFkRes.rows[0].count, 10);
  const lecturerFkCount = parseInt(lecturerFkRes.rows[0].count, 10);
  const adminFkCount = parseInt(adminFkRes.rows[0].count, 10);

  console.log(`[FK Linkage] Student.userId: ${studentFkCount} / ${studentCount}`);
  console.log(`[FK Linkage] Lecturer.userId: ${lecturerFkCount} / ${lecturerCount}`);
  console.log(`[FK Linkage] Admin.userId: ${adminFkCount} / ${adminCount}`);

  // 3. Orphaned Profiles & Users
  const unlinkedStudents = studentCount - studentFkCount;
  const unlinkedLecturers = lecturerCount - lecturerFkCount;
  const unlinkedAdmins = adminCount - adminFkCount;

  const orphanedUsersRes = await client.query(`
    SELECT COUNT(*) FROM "User" u
    LEFT JOIN "Student" s ON s."userId" = u.id
    LEFT JOIN "Lecturer" l ON l."userId" = u.id
    LEFT JOIN "Admin" a ON a."userId" = u.id
    WHERE s.id IS NULL AND l.id IS NULL AND a.id IS NULL;
  `);
  const orphanedUsersCount = parseInt(orphanedUsersRes.rows[0].count, 10);
  console.log(`[Orphans] Unlinked Profiles: Student=${unlinkedStudents}, Lecturer=${unlinkedLecturers}, Admin=${unlinkedAdmins}`);
  console.log(`[Orphans] Orphaned Users (no profile): ${orphanedUsersCount}`);

  // 4. Duplicate Normalized Emails
  const dupEmailRes = await client.query(`
    SELECT "emailNormalized", COUNT(*) 
    FROM "User" 
    GROUP BY "emailNormalized" 
    HAVING COUNT(*) > 1;
  `);
  console.log(`[Duplicates] Duplicate normalized emails in User: ${dupEmailRes.rows.length}`);

  // 5. Duplicate AuthIdentity & Google IDs
  const dupAuthIdent = await client.query(`
    SELECT provider, "providerAccountId", COUNT(*) 
    FROM "AuthIdentity" 
    GROUP BY provider, "providerAccountId" 
    HAVING COUNT(*) > 1;
  `);
  const dupGoogleStudent = await client.query(`
    SELECT "googleId", COUNT(*) 
    FROM "Student" 
    WHERE "googleId" IS NOT NULL 
    GROUP BY "googleId" 
    HAVING COUNT(*) > 1;
  `);
  console.log(`[Duplicates] Duplicate AuthIdentities: ${dupAuthIdent.rows.length}`);
  console.log(`[Duplicates] Duplicate Student googleIds: ${dupGoogleStudent.rows.length}`);

  // 6. PasswordCredential Anomaly Check
  const usersNoPwd = await client.query(`
    SELECT COUNT(*) FROM "User" u
    LEFT JOIN "PasswordCredential" pc ON pc."userId" = u.id
    WHERE pc.id IS NULL;
  `);
  const usersMultiPwd = await client.query(`
    SELECT "userId", COUNT(*) 
    FROM "PasswordCredential" 
    GROUP BY "userId" 
    HAVING COUNT(*) > 1;
  `);
  console.log(`[Credentials] Users without PasswordCredential: ${usersNoPwd.rows[0].count}`);
  console.log(`[Credentials] Users with multiple PasswordCredentials: ${usersMultiPwd.rows.length}`);

  // 7. Broken Foreign Keys Check
  const brokenStudentFk = await client.query(`
    SELECT COUNT(*) FROM "Student" s
    LEFT JOIN "User" u ON s."userId" = u.id
    WHERE s."userId" IS NOT NULL AND u.id IS NULL;
  `);
  const brokenLecturerFk = await client.query(`
    SELECT COUNT(*) FROM "Lecturer" l
    LEFT JOIN "User" u ON l."userId" = u.id
    WHERE l."userId" IS NOT NULL AND u.id IS NULL;
  `);
  const brokenAdminFk = await client.query(`
    SELECT COUNT(*) FROM "Admin" a
    LEFT JOIN "User" u ON a."userId" = u.id
    WHERE a."userId" IS NOT NULL AND u.id IS NULL;
  `);
  console.log(`[FK Integrity] Broken FKs: Student=${brokenStudentFk.rows[0].count}, Lecturer=${brokenLecturerFk.rows[0].count}, Admin=${brokenAdminFk.rows[0].count}`);

  await client.end();
}

auditCanonicalIdentity().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
