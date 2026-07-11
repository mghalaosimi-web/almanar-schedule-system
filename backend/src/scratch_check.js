require('dotenv').config();
const { prisma } = require('./db');

async function main() {
  const colleges = await prisma.college.findMany({
    include: {
      departments: {
        include: {
          majors: true
        }
      }
    }
  });
  console.log('--- COLLEGES & MAJORS ---');
  console.log(JSON.stringify(colleges, null, 2));

  const students = await prisma.student.findMany({
    take: 5,
    orderBy: { id: 'desc' }
  });
  console.log('--- RECENT STUDENTS ---');
  console.log(JSON.stringify(students, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
