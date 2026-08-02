const { prisma } = require('../db');

/**
 * Enterprise Search Engine
 * Performs fast full-text and relational searches across system entities.
 * Assembles deep nested entity trees for students (Profile, Courses, Attendance, Goals).
 */
async function searchEnterprise({ query, type = 'ALL', userScope = {} }) {
  if (!query || String(query).trim().length < 2) {
    return [];
  }

  const q = String(query).trim();
  const searchPattern = { contains: q, mode: 'insensitive' };
  const results = [];

  const searchStudents = type === 'ALL' || type === 'STUDENT';
  const searchSchedules = type === 'ALL' || type === 'SCHEDULE';
  const searchLecturers = type === 'ALL' || type === 'LECTURER';

  // 1. Search Students with nested tree assembly
  if (searchStudents) {
    try {
      const studentWhere = {
        ...userScope.student,
        OR: [
          { name: searchPattern },
          { email: searchPattern },
          { idNumber: searchPattern },
          { phone: searchPattern }
        ]
      };

      const students = await prisma.student.findMany({
        where: studentWhere,
        include: {
          major: true,
          level: true,
          group: true,
          attendances: {
            take: 20,
            orderBy: { date: 'desc' },
            include: { schedule: { include: { subject: true } } }
          },
          goalCompletions: {
            include: { academicGoal: { include: { subject: true } } }
          }
        },
        take: 15
      });

      for (const student of students) {
        const totalClasses = student.attendances.length;
        const presentClasses = student.attendances.filter(a => a.status === 'PRESENT').length;
        const attendanceRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 100;

        let courses = [];
        if (student.groupId) {
          courses = await prisma.schedule.findMany({
            where: { groupId: student.groupId },
            include: { subject: true, room: true },
            take: 10
          });
        }

        results.push({
          type: 'Student',
          id: student.id,
          title: student.name,
          subtitle: `${student.idNumber || ''} • ${student.major?.name || ''} (${student.level?.name || ''})`,
          badge: `حضور ${attendanceRate}%`,
          badgeColor: attendanceRate < 75 ? 'danger' : 'success',
          tree: {
            profile: {
              id: student.id,
              name: student.name,
              email: student.email,
              phone: student.phone,
              idNumber: student.idNumber,
              isRepresentative: student.isRepresentative,
              xp: student.xp,
              streak: student.streak
            },
            major: student.major,
            level: student.level,
            group: student.group,
            courses: courses.map(c => ({
              id: c.id,
              subjectName: c.subject?.name,
              subjectCode: c.subject?.code,
              roomName: c.room?.name,
              dayOfWeek: c.dayOfWeek,
              startTime: c.startTime,
              endTime: c.endTime
            })),
            attendanceSummary: {
              totalClasses,
              presentClasses,
              attendanceRate,
              recentLogs: student.attendances.slice(0, 5)
            },
            completedGoals: student.goalCompletions.map(gc => ({
              id: gc.academicGoal?.id,
              title: gc.academicGoal?.title,
              subject: gc.academicGoal?.subject?.name,
              completedAt: gc.completedAt
            }))
          }
        });
      }
    } catch (err) {
      console.error('[SearchEngine] Error searching students:', err.message);
    }
  }

  // 2. Search Schedules & Subjects
  if (searchSchedules) {
    try {
      const scheduleWhere = {
        ...userScope.schedule,
        OR: [
          { subject: { name: searchPattern } },
          { subject: { code: searchPattern } },
          { lecturerName: searchPattern }
        ]
      };

      const schedules = await prisma.schedule.findMany({
        where: scheduleWhere,
        include: {
          subject: true,
          room: true,
          group: true,
          lecturer: true
        },
        take: 10
      });

      for (const schedule of schedules) {
        results.push({
          type: 'Schedule',
          id: schedule.id,
          title: schedule.subject?.name || 'محاضرة',
          subtitle: `${schedule.subject?.code || ''} • ${schedule.room?.name || ''} • ${schedule.group?.name || ''}`,
          badge: `${schedule.dayOfWeek} ${schedule.startTime}-${schedule.endTime}`,
          badgeColor: 'primary',
          tree: {
            subject: schedule.subject,
            room: schedule.room,
            group: schedule.group,
            lecturer: schedule.lecturerName,
            timeSlot: {
              dayOfWeek: schedule.dayOfWeek,
              startTime: schedule.startTime,
              endTime: schedule.endTime
            }
          }
        });
      }
    } catch (err) {
      console.error('[SearchEngine] Error searching schedules:', err.message);
    }
  }

  // 3. Search Lecturers
  if (searchLecturers) {
    try {
      const lecturerWhere = {
        ...userScope.lecturer,
        OR: [
          { name: searchPattern },
          { email: searchPattern },
          { phone: searchPattern }
        ]
      };

      const lecturers = await prisma.lecturer.findMany({
        where: lecturerWhere,
        include: {
          schedules: { include: { subject: true, group: true } }
        },
        take: 10
      });

      for (const lec of lecturers) {
        results.push({
          type: 'Lecturer',
          id: lec.id,
          title: lec.name,
          subtitle: `${lec.email} • ${lec.phone || ''}`,
          badge: `${lec.schedules.length} محاضرات`,
          badgeColor: 'info',
          tree: {
            profile: { id: lec.id, name: lec.name, email: lec.email, phone: lec.phone },
            assignedSchedules: lec.schedules
          }
        });
      }
    } catch (err) {
      console.error('[SearchEngine] Error searching lecturers:', err.message);
    }
  }

  return results;
}

module.exports = {
  searchEnterprise
};
