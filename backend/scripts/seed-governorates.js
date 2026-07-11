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

async function upsertCollegeWithMajors(uniId, collegeName, collegeSlug, majorsList) {
  const college = await prisma.college.upsert({
    where: { slug: collegeSlug },
    update: { universityId: uniId },
    create: {
      name: collegeName,
      slug: collegeSlug,
      universityId: uniId
    }
  });

  // Find or create department
  let department = await prisma.department.findFirst({
    where: { collegeId: college.id, name: collegeName }
  });
  if (!department) {
    department = await prisma.department.create({
      data: {
        name: collegeName,
        collegeId: college.id
      }
    });
  }

  // Create majors
  for (const majorName of majorsList) {
    const existingMajor = await prisma.major.findFirst({
      where: { departmentId: department.id, name: majorName }
    });
    if (!existingMajor) {
      await prisma.major.create({
        data: {
          name: majorName,
          departmentId: department.id
        }
      });
    }
  }
  console.log(`Upserted college: ${collegeName} with ${majorsList.length} majors.`);
}

async function main() {
  console.log('--- STARTING SECURE DATABASE UPDATE ---');

  // Step 1: Create/Upsert Governorates
  const targetGovernorates = ["حجة"];
  const govMap = {};
  for (const name of targetGovernorates) {
    const gov = await prisma.governorate.upsert({
      where: { name },
      update: {},
      create: { name }
    });
    govMap[name] = gov;
    console.log(`Governorate: ${name} (ID: ${gov.id})`);
  }

  // Step 2: Link Existing Hajjah Universities (Preserve Existing Data)
  const universities = await prisma.university.findMany();
  for (const uni of universities) {
    if (uni.name.includes('المنار') || uni.name.includes('Manar') || uni.name.includes('حجة') || uni.name.includes('Hajjah')) {
      await prisma.university.update({
        where: { id: uni.id },
        data: { governorateId: govMap['حجة'].id }
      });
      console.log(`Safely linked existing university: "${uni.name}" to Governorate: "حجة"`);
    }
  }

  console.log('--- DATABASE SECURE UPDATE COMPLETE ---');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Error during database update:', e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
