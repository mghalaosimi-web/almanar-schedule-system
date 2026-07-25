require('dotenv').config();
const { prisma } = require('./db');

async function run() {
  try {
    console.log('Querying students in the database...');
    const students = await prisma.student.findMany({
      where: {
        OR: [
          { name: { contains: 'mohammed', mode: 'insensitive' } },
          { name: { contains: 'ghalib', mode: 'insensitive' } },
          { name: { contains: 'alaosimi', mode: 'insensitive' } },
          { email: { contains: 'alosimi', mode: 'insensitive' } },
          { email: { contains: 'alaosimi', mode: 'insensitive' } }
        ]
      },
      include: {
        group: true
      }
    });

    console.log(`Found ${students.length} matching students:`);
    students.forEach(s => {
      console.log({
        id: s.id,
        name: s.name,
        email: s.email,
        groupId: s.groupId,
        groupName: s.group ? s.group.name : null,
        isRepresentative: s.isRepresentative,
        collegeId: s.collegeId
      });
    });

    // Also let's inspect the group table to see what groups exist
    const groups = await prisma.group.findMany({
      take: 10
    });
    console.log('Sample Groups in database:', groups.map(g => ({ id: g.id, name: g.name, collegeId: g.collegeId })));

  } catch (err) {
    console.error('Error querying:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
