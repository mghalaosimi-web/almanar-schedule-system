process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection at:', reason);
  process.exit(1);
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runBackfill() {
  console.log('=== DIRECTIVE 10.4: UNIFIED AUTHENTICATION BACKFILL ===\n');

  try {
    // 1. Core Roles
    console.log('[1/6] Ensuring core Roles exist in DB...');
    const rolesMap = {};
    const rolesToCreate = [
      { key: 'SYSTEM_OWNER', name: 'System Owner' },
      { key: 'SUPER_ADMIN', name: 'Super Admin' },
      { key: 'UNI_ADMIN', name: 'University Admin' },
      { key: 'COLLEGE_ADMIN', name: 'College Admin' },
      { key: 'ADMIN', name: 'Administrator' },
      { key: 'LECTURER', name: 'Lecturer' },
      { key: 'STUDENT', name: 'Student' },
      { key: 'STUDENT_REPRESENTATIVE', name: 'Student Representative' }
    ];

    for (const r of rolesToCreate) {
      const role = await prisma.role.upsert({
        where: { key: r.key },
        update: { name: r.name },
        create: { key: r.key, name: r.name }
      });
      rolesMap[r.key] = role.id;
    }

    // 2. Core Portals
    console.log('[2/6] Ensuring core Portals exist in DB...');
    const portalsToCreate = [
      { key: 'STUDENT_PORTAL', name: 'Student Portal', route: '/student' },
      { key: 'LECTURER_PORTAL', name: 'Lecturer Portal', route: '/lecturer' },
      { key: 'ADMIN_PORTAL', name: 'Admin Portal', route: '/admin' },
      { key: 'SUPER_ADMIN_PORTAL', name: 'Super Admin Portal', route: '/admin' }
    ];
    for (const p of portalsToCreate) {
      await prisma.portal.upsert({
        where: { key: p.key },
        update: { name: p.name, route: p.route },
        create: p
      });
    }

    // Helper: get or upsert user safely
    async function getOrUpsertUser(email, displayName) {
      const trimmedEmail = email.trim();
      const normalizedEmail = trimmedEmail.toLowerCase();

      // Try finding by normalized email first
      let user = await prisma.user.findFirst({
        where: { emailNormalized: normalizedEmail }
      });

      if (!user) {
        user = await prisma.user.upsert({
          where: { emailNormalized: normalizedEmail },
          update: { displayName: displayName.trim() || 'System User' },
          create: {
            email: trimmedEmail,
            emailNormalized: normalizedEmail,
            displayName: displayName.trim() || 'System User'
          }
        });
      }
      return user;
    }

    // 3. Process Admins
    console.log('[3/6] Backfilling Admins...');
    const admins = await prisma.admin.findMany();
    for (const admin of admins) {
      const user = await getOrUpsertUser(admin.email, admin.name);

      await prisma.admin.update({
        where: { id: admin.id },
        data: { userId: user.id }
      });

      if (admin.password) {
        await prisma.passwordCredential.upsert({
          where: { userId: user.id },
          update: { passwordHash: admin.password },
          create: { userId: user.id, passwordHash: admin.password }
        });
      }

      const roleKey = admin.role || 'ADMIN';
      const roleId = rolesMap[roleKey] || rolesMap['ADMIN'];
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        update: {},
        create: { userId: user.id, roleId }
      });

      const normalized = admin.email.trim().toLowerCase();
      if (normalized === 'm.gh.alosimi@gmail.com' || normalized === 'm.gh.alaosimi@gmail.com') {
        const ownerRoleId = rolesMap['SYSTEM_OWNER'];
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: ownerRoleId } },
          update: {},
          create: { userId: user.id, roleId: ownerRoleId }
        });
      }
    }

    // 4. Process Lecturers
    console.log('[4/6] Backfilling Lecturers...');
    const lecturers = await prisma.lecturer.findMany();
    for (const lecturer of lecturers) {
      const user = await getOrUpsertUser(lecturer.email, lecturer.name);

      await prisma.lecturer.update({
        where: { id: lecturer.id },
        data: { userId: user.id }
      });

      if (lecturer.password) {
        await prisma.passwordCredential.upsert({
          where: { userId: user.id },
          update: { passwordHash: lecturer.password },
          create: { userId: user.id, passwordHash: lecturer.password }
        });
      }

      const lecturerRoleId = rolesMap['LECTURER'];
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: lecturerRoleId } },
        update: {},
        create: { userId: user.id, roleId: lecturerRoleId }
      });
    }

    // 5. Process Students
    console.log('[5/6] Backfilling Students...');
    const students = await prisma.student.findMany();
    console.log(` Found ${students.length} Students to process...`);
    
    let processedCount = 0;
    for (const student of students) {
      const user = await getOrUpsertUser(student.email, student.name);

      await prisma.student.update({
        where: { id: student.id },
        data: { userId: user.id }
      });

      if (student.password) {
        await prisma.passwordCredential.upsert({
          where: { userId: user.id },
          update: { passwordHash: student.password },
          create: { userId: user.id, passwordHash: student.password }
        });
      }

      if (student.googleId) {
        await prisma.authIdentity.upsert({
          where: {
            provider_providerAccountId: {
              provider: 'google',
              providerAccountId: student.googleId
            }
          },
          update: { userId: user.id, email: student.email },
          create: {
            userId: user.id,
            provider: 'google',
            providerAccountId: student.googleId,
            email: student.email
          }
        });
      }

      const studentRoleId = rolesMap['STUDENT'];
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: studentRoleId } },
        update: {},
        create: { userId: user.id, roleId: studentRoleId }
      });

      if (student.isRepresentative) {
        const repRoleId = rolesMap['STUDENT_REPRESENTATIVE'];
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: repRoleId } },
          update: {},
          create: { userId: user.id, roleId: repRoleId }
        });
      }

      processedCount++;
      if (processedCount % 200 === 0 || processedCount === students.length) {
        console.log(`   Processed ${processedCount}/${students.length} students...`);
      }
    }

    console.log('\n[6/6] Backfill completed successfully!');
    console.log('✅ BACKFILL = PASS');
  } catch (err) {
    console.error('❌ BACKFILL = FAIL', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runBackfill();
