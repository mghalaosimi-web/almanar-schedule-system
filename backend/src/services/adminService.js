/**
 * @file adminService.js
 * @description خدمة المشرفين لتأمين الصلاحيات الإدارية، جمع مقاييس تيليميتري النظام، وتجميع البيانات التحليلية المتقدمة.
 * @author أنتيجرافيتي (Antigravity)
 */

const { prisma } = require('../db');
const os = require('os');
const systemSettings = require('./systemSettings');
const { getOnlineUsers, getActivityLogs } = require('./sessionTracker');

/**
 * التحقق من رتبة وصلاحيات المستخدم الإدارية.
 * 
 * @param {Object} user - كائن المستخدم المستخلص من رمز التوثيق (JWT).
 * @returns {boolean} صحيح إذا كان المستخدم ذو صلاحيات إدارية (أدمن خارق، أدمن جامعة، أدمن كلية).
 */
function isAuthorizedAdmin(user) {
  const role = user?.role;
  return role === 'SUPER_ADMIN' || role === 'UNI_ADMIN' || role === 'COLLEGE_ADMIN';
}

/**
 * دالة لتأمين وحصر نطاقات البيانات (Isolation Scoping) للمشرفين بناءً على أدوارهم لمنع تسريب البيانات بين المؤسسات.
 * 
 * المنطق البرمجي:
 * - المشرف العام (SUPER_ADMIN): لا يُطبق عليه أي قيود (يعيد كائن فلترة فارغ).
 * - مشرف الجامعة (UNI_ADMIN): يُحصر نطاق استعلاماته بالجامعة المسجل عليها فقط.
 * - مشرف الكلية (COLLEGE_ADMIN): يُحصر نطاق استعلاماته بالكلية المسجل عليها فقط.
 * 
 * @param {Object} user - كائن المستخدم المستخلص من التوثيق.
 * @param {string} modelName - اسم كينونة النموذج في Prisma (مثل Student, College, Major).
 * @returns {Object} كائن الفلترة (Where Clause) المتوافق مع نموذج Prisma.
 */
function getModelScope(user, modelName) {
  const { role, universityId, collegeId } = user;
  
  if (role === 'SUPER_ADMIN') {
    return {};
  }
  
  if (role === 'UNI_ADMIN') {
    if (!universityId) return { id: -1 };
    if (modelName === 'University') {
      return { id: parseInt(universityId) };
    }
    if (modelName === 'College') {
      return { universityId: parseInt(universityId) };
    }
    return {
      college: {
        universityId: parseInt(universityId)
      }
    };
  }
  
  if (role === 'COLLEGE_ADMIN') {
    if (!collegeId) return { id: -1 };
    if (modelName === 'University') {
      return { colleges: { some: { id: parseInt(collegeId) } } };
    }
    if (modelName === 'College') {
      return { id: parseInt(collegeId) };
    }
    if (modelName === 'Department') {
      return { collegeId: parseInt(collegeId) };
    }
    return { collegeId: parseInt(collegeId) };
  }
  
  return { id: -1 };
}

/**
 * تجميع إحصائيات تحليلات النظام وحساب مؤشر صحة الحضور (Attendance Health Index) للثلاثين يوماً الأخيرة.
 * 
 * المنطق البرمجي والرياضي للعملية:
 * 1. تحديد النطاق الإداري للمشرف الجاري.
 * 2. احتساب عدد الطلاب الإجمالي والمجموعات والجدول الدراسي الفعلي.
 * 3. استعلام سجلات الحضور للأيام الثلاثين الفائتة وتجميعها بناءً على حالتها (PRESENT, ABSENT, EXCUSED).
 * 4. حساب النسبة المئوية لصحة الحضور: عدد الحاضرين (PRESENT) مقسوماً على إجمالي السجلات للثلاثين يوماً الفائتة مضروباً في 100.
 * 5. استرجاع أكبر 6 شعب دراسية حجماً (عدد طلابها) وعرض توزيعها لتمكين المشرف من معرفة الكتل البشرية للطلاب.
 * 
 * @param {number} [collegeId] - معرف الكلية المحددة (في حال طلب المشرف العام تصفية محددة).
 * @param {Object} user - كائن المشرف لفرض الصلاحيات.
 * @returns {Promise<Object>} تحليلات ومؤشرات أداء النظام.
 */
async function getAnalytics(collegeId, user) {
  let studentScope = getModelScope(user, 'Student');
  let scheduleScope = getModelScope(user, 'Schedule');
  let groupScope = getModelScope(user, 'Group');

  if (user.role === 'SUPER_ADMIN' && collegeId) {
    const parsedCollegeId = parseInt(collegeId);
    studentScope = { collegeId: parsedCollegeId };
    scheduleScope = { collegeId: parsedCollegeId };
    groupScope = { collegeId: parsedCollegeId };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [totalStudents, totalGroups, totalSchedules, attendanceSummary, groupBreakdown] = await Promise.all([
    prisma.student.count({ where: studentScope }),
    prisma.group.count({ where: groupScope }),
    prisma.schedule.count({ where: scheduleScope }),
    // حساب صحة الحضور: التجميع بناءً على الحالة للثلاثين يوماً الماضية
    prisma.attendance.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { date: { gte: thirtyDaysAgo } }
    }),
    // تفكيك الشعب: جلب أكبر 6 شعب من حيث عدد الطلاب
    prisma.group.findMany({
      where: groupScope,
      select: {
        id: true,
        name: true,
        _count: { select: { students: true } }
      },
      orderBy: { students: { _count: 'desc' } },
      take: 6
    })
  ]);

  // حساب النسبة المئوية لصحة الحضور
  let presentCount = 0;
  let totalCount = 0;
  for (const row of attendanceSummary) {
    totalCount += row._count.id;
    if (row.status === 'PRESENT') presentCount += row._count.id;
  }
  const attendanceHealth = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : null;

  const absentCount = attendanceSummary.find(r => r.status === 'ABSENT')?._count.id ?? 0;
  const excusedCount = attendanceSummary.find(r => r.status === 'EXCUSED')?._count.id ?? 0;

  return {
    totalStudents,
    totalGroups,
    totalSchedules,
    attendanceHealth,           // null في حال عدم وجود سجلات
    attendanceWindow: 30,       // نافذة الأيام
    presentCount,
    absentCount,
    excusedCount,
    totalAttendanceRecords: totalCount,
    groupBreakdown: groupBreakdown.map(g => ({
      groupId: g.id,
      groupName: g.name,
      studentCount: g._count.students
    }))
  };
}

/**
 * جمع مقاييس أداء وتتبع النظام الفنية والاتصالات الحية (System Telemetry Data).
 * 
 * المنطق البرمجي:
 * 1. التحقق من صلاحيات المشرف العام (SUPER_ADMIN).
 * 2. قياس زمن استجابة خادم قاعدة البيانات (DB Latency) عبر استعلام وهمي سريع وقياس الزمن المستغرق.
 * 3. استرجاع الأعداد الإجمالية لكافة الجداول في النظام في وقت واحد (Parallelization).
 * 4. جمع إحصائيات تشغيل الخادم الفيزيائي (نظام التشغيل، معمارية المعالج، الذاكرة المستهلكة من محرك Node.js، ووقت تشغيل الخادم Uptime).
 * 5. جلب السجلات والطلبات النشطة والطلاب المتصلين عبر الويب وتصديرها.
 * 
 * @returns {Promise<Object>} مقاييس تيليميتري الخادم ومؤشرات الاتصال الحالية.
 */
async function getTelemetry() {
  // حساب زمن استجابة قاعدة البيانات
  const dbStart = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const dbLatency = Date.now() - dbStart;

  // جلب كافة أعداد عناصر النظام بالتوازي
  const [
    studentCount,
    lecturerCount,
    roomCount,
    groupCount,
    collegeCount,
    universityCount,
    scheduleCount,
    examScheduleCount,
    notificationLogCount,
    rescheduleRequestCount,
    attendanceCount
  ] = await Promise.all([
    prisma.student.count(),
    prisma.lecturer.count(),
    prisma.room.count(),
    prisma.group.count(),
    prisma.college.count(),
    prisma.university.count(),
    prisma.schedule.count(),
    prisma.examSchedule.count(),
    prisma.notificationLog.count(),
    prisma.rescheduleRequest.count(),
    prisma.attendance.count()
  ]);

  // جلب آخر الإشعارات المرسلة
  const recentLogs = await prisma.notificationLog.findMany({
    take: 15,
    orderBy: { sentTime: 'desc' },
    include: { group: true }
  });

  // جلب طلبات الدكاترة الأخيرة لإعادة الجدولة
  const recentRequests = await prisma.rescheduleRequest.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      lecturer: true,
      schedule: {
        include: { subject: true }
      }
    }
  });

  return {
    counts: {
      students: studentCount,
      lecturers: lecturerCount,
      rooms: roomCount,
      groups: groupCount,
      colleges: collegeCount,
      universities: universityCount,
      schedules: scheduleCount,
      examSchedules: examScheduleCount,
      notificationLogs: notificationLogCount,
      rescheduleRequests: rescheduleRequestCount,
      attendances: attendanceCount
    },
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      dbLatency
    },
    settings: systemSettings.getAll(),
    recentLogs,
    recentRequests,
    onlineUsers: getOnlineUsers(),
    activityLogs: getActivityLogs()
  };
}

module.exports = {
  isAuthorizedAdmin,
  getModelScope,
  getAnalytics,
  getTelemetry
};
