require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- STARTING RBAC MIGRATION SCRIPT ---');

  // 1. Update standard admin account admin.applied@manar.edu to COLLEGE_ADMIN
  const standardAdmin = await prisma.admin.findUnique({
    where: { email: 'admin.applied@manar.edu' }
  });

  if (standardAdmin) {
    await prisma.admin.update({
      where: { id: standardAdmin.id },
      data: { role: 'COLLEGE_ADMIN' }
    });
    console.log('Successfully set "admin.applied@manar.edu" to COLLEGE_ADMIN role.');
  } else {
    console.log('Standard admin "admin.applied@manar.edu" not found in database. Seeding standard admin...');
    // Find a college to link to
    const appliedCollege = await prisma.college.findFirst({
      where: { slug: 'applied-sciences' }
    });
    if (appliedCollege) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('12345678', 10);
      await prisma.admin.create({
        data: {
          name: 'Applied Sciences Admin',
          email: 'admin.applied@manar.edu',
          password: hash,
          role: 'COLLEGE_ADMIN',
          collegeId: appliedCollege.id
        }
      });
      console.log('Created standard COLLEGE_ADMIN for Applied Sciences.');
    }
  }

  // 2. Ensure all other legacy ADMIN roles are set to SUPER_ADMIN to avoid lockouts
  const allAdmins = await prisma.admin.findMany();
  for (const admin of allAdmins) {
    if (admin.email !== 'admin.applied@manar.edu' && admin.role !== 'SUPER_ADMIN') {
      // Force others to SUPER_ADMIN if they had legacy ADMIN
      await prisma.admin.update({
        where: { id: admin.id },
        data: { role: 'SUPER_ADMIN' }
      });
      console.log(`Updated admin ${admin.email} to SUPER_ADMIN.`);
    }
  }

  console.log('--- RBAC MIGRATION SCRIPT COMPLETE ---');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Error during migration execution:', e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
