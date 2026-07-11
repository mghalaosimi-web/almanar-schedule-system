require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- SAFELY ENSURING DEVELOPER SUPER_ADMIN ACCOUNT ---');
  const email = 'm.gh.alosimi@gmail.com';
  const rawPassword = '708090';
  
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(rawPassword, salt);

  const existingAdmin = await prisma.admin.findUnique({
    where: { email }
  });

  if (existingAdmin) {
    console.log(`Admin "${email}" already exists. Updating password and forcing SUPER_ADMIN role...`);
    await prisma.admin.update({
      where: { id: existingAdmin.id },
      data: {
        password: hashedPassword,
        role: 'SUPER_ADMIN'
      }
    });
    console.log('Developer account successfully updated!');
  } else {
    console.log(`Admin "${email}" not found. Creating brand new SUPER_ADMIN...`);
    await prisma.admin.create({
      data: {
        name: 'Chief Architect',
        email,
        password: hashedPassword,
        role: 'SUPER_ADMIN'
      }
    });
    console.log('Developer account successfully created!');
  }
  console.log('--- COMPLETED ---');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Error during execution:', e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
