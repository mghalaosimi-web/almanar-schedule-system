const { prisma } = require('../db');

/**
 * Calculates per-student Attendance Risk Classification.
 * Rules:
 * - HIGH risk: attendance < 75%
 * - MEDIUM risk: attendance 75% - 85%
 * - LOW risk: attendance > 85%
 */
async function calculateAttendanceRisk({ collegeId, groupId, userScope = {} }) {
  const whereClause = {
    ...userScope
  };
  if (collegeId) whereClause.collegeId = parseInt(collegeId);
  if (groupId) whereClause.groupId = parseInt(groupId);

  const students = await prisma.student.findMany({
    where: whereClause,
    include: {
      major: true,
      level: true,
      group: true,
      attendances: {
        select: { status: true, date: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  const highRiskStudents = [];
  const mediumRiskStudents = [];
  const lowRiskStudents = [];

  for (const student of students) {
    const total = student.attendances.length;
    const present = student.attendances.filter(a => a.status === 'PRESENT').length;
    const absent = student.attendances.filter(a => a.status === 'ABSENT').length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 100;

    const studentRisk = {
      id: student.id,
      name: student.name,
      idNumber: student.idNumber || '—',
      email: student.email,
      phone: student.phone,
      majorName: student.major?.name || 'غير محدد',
      levelName: student.level?.name || 'غير محدد',
      groupName: student.group?.name || 'غير محدد',
      attendanceRate: rate,
      totalClasses: total,
      presentClasses: present,
      absentClasses: absent,
      riskLevel: rate < 75 ? 'HIGH' : (rate <= 85 ? 'MEDIUM' : 'LOW')
    };

    if (rate < 75) {
      highRiskStudents.push(studentRisk);
    } else if (rate <= 85) {
      mediumRiskStudents.push(studentRisk);
    } else {
      lowRiskStudents.push(studentRisk);
    }
  }

  const totalStudents = students.length;

  return {
    summary: {
      totalStudents,
      highRiskCount: highRiskStudents.length,
      mediumRiskCount: mediumRiskStudents.length,
      lowRiskCount: lowRiskStudents.length,
      highRiskPercentage: totalStudents > 0 ? Math.round((highRiskStudents.length / totalStudents) * 100) : 0
    },
    highRiskStudents,
    mediumRiskStudents,
    lowRiskStudents
  };
}

/**
 * Analyzes Course/Subject Failure & Absence Risk.
 * Rules:
 * - If absence rate > 30%, flags HIGH_FAILURE_RISK and recommends an Extra Revision Session.
 */
async function analyzeCoursePerformance({ collegeId, userScope = {} }) {
  const whereClause = {
    ...userScope
  };
  if (collegeId) whereClause.collegeId = parseInt(collegeId);

  const subjects = await prisma.subject.findMany({
    where: whereClause,
    include: {
      schedules: {
        include: {
          attendances: { select: { status: true } }
        }
      }
    }
  });

  const report = subjects.map(sub => {
    let totalRecords = 0;
    let absentRecords = 0;

    sub.schedules.forEach(sched => {
      sched.attendances.forEach(att => {
        totalRecords++;
        if (att.status === 'ABSENT') absentRecords++;
      });
    });

    const failureAbsenceRate = totalRecords > 0 ? Math.round((absentRecords / totalRecords) * 100) : 0;
    const isHighRisk = failureAbsenceRate > 30;

    return {
      subjectId: sub.id,
      subjectName: sub.name,
      subjectCode: sub.code,
      type: sub.type,
      totalClassesRecorded: totalRecords,
      absentRecords,
      failureAbsenceRate,
      riskLevel: isHighRisk ? 'HIGH_FAILURE_RISK' : 'NORMAL',
      recommendation: isHighRisk
        ? 'جلسة مراجعة إضافية متطلبة (Extra Session Required)'
        : 'أداء منتظم وضمن المعدل الطبيعي'
    };
  });

  return report.sort((a, b) => b.failureAbsenceRate - a.failureAbsenceRate);
}

module.exports = {
  calculateAttendanceRisk,
  analyzeCoursePerformance
};
