require('dotenv').config();
const { prisma } = require('./src/db');

async function main() {
  // Aggregate schedules by Group ID
  const schedules = await prisma.schedule.findMany({
    include: {
      group: {
        include: {
          major: true,
          level: true
        }
      }
    }
  });

  const groupCounts = {};
  schedules.forEach(s => {
    const key = `Group ID: ${s.groupId} (${s.group?.name || 'N/A'}), Major: ${s.group?.major?.name || 'N/A'} (ID: ${s.group?.majorId || 'N/A'}), Level: ${s.group?.level?.name || 'N/A'} (ID: ${s.group?.levelId || 'N/A'})`;
    groupCounts[key] = (groupCounts[key] || 0) + 1;
  });

  console.log('--- SCHEDULE COUNTS BY GROUP ---');
  Object.keys(groupCounts).forEach(k => {
    console.log(`${k} -> ${groupCounts[k]} schedules`);
  });

  console.log('\n--- FIRST 5 STUDENTS ---');
  const students = await prisma.student.findMany({
    take: 5,
    include: { major: true, level: true, group: true }
  });
  students.forEach(s => {
    console.log(`Student: ${s.name}, Major ID: ${s.majorId} (${s.major?.name}), Level ID: ${s.levelId} (${s.level?.name}), Group ID: ${s.groupId} (${s.group?.name})`);
  });
}

main().catch(err => {
  console.error(err);
}).finally(() => {
  prisma.$disconnect();
});
