process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

async function run() {
  console.log('=== LIGHTNING SQL BACKFILL FOR STUDENTS ===');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('[1/5] Inserting missing User rows for Students...');
  const res1 = await client.query(`
    INSERT INTO "User" (id, email, "emailNormalized", "displayName", "isActive", "createdAt", "updatedAt")
    SELECT gen_random_uuid(), s.email, LOWER(TRIM(s.email)), COALESCE(NULLIF(TRIM(s.name), ''), 'Student User'), true, NOW(), NOW()
    FROM "Student" s
    WHERE s."userId" IS NULL
    ON CONFLICT ("emailNormalized") DO NOTHING;
  `);
  console.log(` -> Users created: ${res1.rowCount}`);

  console.log('[2/5] Linking Student.userId FKs...');
  const res2 = await client.query(`
    UPDATE "Student" s
    SET "userId" = u.id
    FROM "User" u
    WHERE LOWER(TRIM(s.email)) = u."emailNormalized" AND s."userId" IS NULL;
  `);
  console.log(` -> Students linked: ${res2.rowCount}`);

  console.log('[3/5] Inserting PasswordCredentials...');
  const res3 = await client.query(`
    INSERT INTO "PasswordCredential" (id, "userId", "passwordHash", "createdAt", "updatedAt")
    SELECT gen_random_uuid(), s."userId", s.password, NOW(), NOW()
    FROM "Student" s
    WHERE s.password IS NOT NULL AND s."userId" IS NOT NULL
    ON CONFLICT ("userId") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";
  `);
  console.log(` -> PasswordCredentials created/updated: ${res3.rowCount}`);

  console.log('[4/5] Inserting AuthIdentities (Google)...');
  const res4 = await client.query(`
    INSERT INTO "AuthIdentity" (id, "userId", provider, "providerAccountId", email, metadata, "createdAt", "updatedAt")
    SELECT gen_random_uuid(), s."userId", 'google', s."googleId", s.email, '{}'::json, NOW(), NOW()
    FROM "Student" s
    WHERE s."googleId" IS NOT NULL AND s."userId" IS NOT NULL
    ON CONFLICT (provider, "providerAccountId") DO UPDATE SET "userId" = EXCLUDED."userId";
  `);
  console.log(` -> AuthIdentities created/updated: ${res4.rowCount}`);

  console.log('[5/5] Inserting UserRoles...');
  const res5 = await client.query(`
    INSERT INTO "UserRole" ("userId", "roleId", "createdAt")
    SELECT s."userId", r.id, NOW()
    FROM "Student" s
    CROSS JOIN "Role" r
    WHERE r.key = 'STUDENT' AND s."userId" IS NOT NULL
    ON CONFLICT ("userId", "roleId") DO NOTHING;
  `);
  console.log(` -> STUDENT UserRoles created: ${res5.rowCount}`);

  const res6 = await client.query(`
    INSERT INTO "UserRole" ("userId", "roleId", "createdAt")
    SELECT s."userId", r.id, NOW()
    FROM "Student" s
    CROSS JOIN "Role" r
    WHERE r.key = 'STUDENT_REPRESENTATIVE' AND s."isRepresentative" = TRUE AND s."userId" IS NOT NULL
    ON CONFLICT ("userId", "roleId") DO NOTHING;
  `);
  console.log(` -> STUDENT_REPRESENTATIVE UserRoles created: ${res6.rowCount}`);

  await client.end();
  console.log('\n✅ LIGHTNING BACKFILL COMPLETED SUCCESSFULLY');
}

run().catch(err => {
  console.error('Error during lightning backfill:', err);
  process.exit(1);
});
