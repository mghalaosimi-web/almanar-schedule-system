require('dotenv').config();
const { prisma } = require('./db');

async function run() {
  try {
    console.log('Updating student mohammed ghalib alaosimi (ID: 1006) to set groupId: 1...');
    const student = await prisma.student.update({
      where: { id: 1006 },
      data: {
        groupId: 1,
        // Let's also ensure majorId and levelId are set to match group 1 if needed
      },
      include: {
        group: true
      }
    });

    console.log('Successfully updated student:', {
      id: student.id,
      name: student.name,
      groupId: student.groupId,
      groupName: student.group ? student.group.name : null,
      isRepresentative: student.isRepresentative
    });

  } catch (err) {
    console.error('Error updating student:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
