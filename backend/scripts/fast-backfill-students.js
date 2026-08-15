process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fastBackfillStudents() {
  console.log('=== BULK STUDENT BACKFILL ===');

  const studentRole = await prisma.role.findUnique({ where: { key: 'STUDENT' } });
  const repRole = await prisma.role.findUnique({ where: { key: 'STUDENT_REPRESENTATIVE' } });

  // Get all unlinked students
  const unlinkedStudents = await prisma.student.findMany({
    where: { userId: null }
  });

  console.log(`Unlinked Students remaining: ${unlinkedStudents.length}`);
  if (unlinkedStudents.length === 0) {
    console.log('All students are already linked!');
    process.exit(0);
  }

  // 1. Prepare User objects
  const usersToCreate = [];
  const studentMap = {};

  for (const s of unlinkedStudents) {
    const trimmedEmail = s.email.trim();
    const normalizedEmail = trimmedEmail.toLowerCase();
    
    // Check if user already exists
    let existing = await prisma.user.findFirst({ where: { emailNormalized: normalizedEmail } });
    if (!existing) {
      existing = await prisma.user.create({
        data: {
          email: trimmedEmail,
          emailNormalized: normalizedEmail,
          displayName: s.name.trim() || 'Student User'
        }
      });
    }

    // Link student
    await prisma.student.update({
      where: { id: s.id },
      data: { userId: existing.id }
    });

    // Create PasswordCredential if password present
    if (s.password) {
      await prisma.passwordCredential.upsert({
        where: { userId: existing.id },
        update: { passwordHash: s.password },
        create: { userId: existing.id, passwordHash: s.password }
      });
    }

    // Create AuthIdentity if googleId present
    if (s.googleId) {
      await prisma.authIdentity.upsert({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: s.googleId
          }
        },
        update: { userId: existing.id, email: s.email },
        create: {
          userId: existing.id,
          provider: 'google',
          providerAccountId: s.googleId,
          email: s.email
        }
      });
    }

    // Create UserRole
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: existing.id, roleId: studentRole.id } },
      update: {},
      create: { userId: existing.id, roleId: studentRole.id }
    });

    if (s.isRepresentative && repRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: existing.id, roleId: repRole.id } },
        update: {},
        create: { userId: existing.id, roleId: repRole.id }
      });
    }
  }

  console.log('\n✅ ALL REMAINING STUDENTS BACKFILLED CLEANLY');
}

fastBackfillStudents()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error in bulk student backfill:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
