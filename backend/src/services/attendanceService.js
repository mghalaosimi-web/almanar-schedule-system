/**
 * @file attendanceService.js
 * @description خدمة إدارة عمليات التحضير والتحقق الجغرافي وحساب إحصائيات الحضور والغياب للطلاب.
 * @author أنتيجرافيتي (Antigravity)
 */

const { prisma } = require('../db');
const jwt = require('jsonwebtoken');
const { broadcastSSE } = require('./notifications');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * حساب المسافة الجغرافية بين نقطتين على سطح الأرض باستخدام صيغة هافرسين (Haversine Formula).
 * 
 * المنطق الرياضي للعملية:
 * - تعتمد صيغة هافرسين على حساب الزاوية المركزية بين نقطتين على مجسم كروي باستخدام خطوط الطول ودائرة العرض.
 * - dLat: فرق دوائر العرض بالراديان.
 * - dLon: فرق خطوط الطول بالراديان.
 * - المتغير 'a' يمثل مربع نصف طول وتر الزاوية المركزية المستقيمة بين النقطتين.
 * - المتغير 'c' يمثل المسافة الزاوية بالراديان.
 * - R: نصف قطر الأرض بالأمتار (6371000 متر).
 * 
 * @param {number} lat1 - خط العرض للنقطة الأولى (إحداثيات الطالب).
 * @param {number} lon1 - خط الطول للنقطة الأولى (إحداثيات الطالب).
 * @param {number} lat2 - خط العرض للنقطة الثانية (إحداثيات الكلية).
 * @param {number} lon2 - خط الطول للنقطة الثانية (إحداثيات الكلية).
 * @returns {number} المسافة الفاصلة بين النقطتين بالأمتار.
 */
function getCoordinateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // نصف قطر الأرض بالأمتار
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // المسافة بالأمتار
}

/**
 * معالجة وتوثيق حضور الطالب عبر مسح رمز الاستجابة السريعة (QR Code).
 * 
 * المنطق البرمجي والتدفق:
 * 1. فك تشفير وفحص سلامة الـ JWT Token المرسل من رمز الـ QR.
 * 2. التحقق من أن الرمز مخصص لعملية التحضير (ATTENDANCE_QR).
 * 3. حساب المسافة الجغرافية بين إحداثيات الطالب المدخلة وإحداثيات الكلية المركزية للتأكد من وجوده الفعلي داخل الحرم الجامعي (النطاق المسموح: 150 متر).
 * 4. مقارنة توقيت التحضير الفعلي بوقت بدء المحاضرة المجدولة:
 *    - إذا تجاوز وقت التحضير وقت بدء المحاضرة بأكثر من 15 دقيقة، يتم تسجيل حالة الحضور كمتأخر (LATE).
 *    - خلافاً لذلك، تسجل كحاضر (PRESENT).
 * 5. تحديث أو إنشاء سجل الحضور (Upsert) في جدول AttendanceRecord لتجنب تكرار التحضير لنفس اليوم.
 * 6. إرسال إشعار فوري عبر قنوات البث المباشر (SSE Broadcast) لتحديث واجهة الدكتور أو المسؤول في الوقت الحقيقي.
 * 
 * @param {number} studentId - المعرف الفريد للطالب.
 * @param {string} token - الرمز الرقمي المشفر الممسوح من شاشة العرض (QR Token).
 * @param {number} latitude - خط العرض لموقع الطالب الفعلي عبر نظام تحديد المواقع (GPS).
 * @param {number} longitude - خط الطول لموقع الطالب الفعلي عبر نظام تحديد المواقع (GPS).
 * @returns {Promise<Object>} كائن يحتوي على نتيجة العملية وسجل الحضور الذي تم إنشاؤه.
 * @throws {Error} في حال كان الرمز منتهي الصلاحية، غير صالح، أو خارج النطاق الجغرافي.
 */
async function scanCheckIn(studentId, token, latitude, longitude) {
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new Error('Invalid or expired QR code');
  }

  if (decoded.role !== 'ATTENDANCE_QR') {
    throw new Error('Invalid QR token payload');
  }

  const CAMPUS_LAT = 15.35;
  const CAMPUS_LON = 44.20;
  const ALLOWED_RADIUS = 150; // النطاق المسموح به بالأمتار

  if (latitude === undefined || longitude === undefined) {
    throw new Error('GPS coordinates are required to verify location');
  }

  const distance = getCoordinateDistance(latitude, longitude, CAMPUS_LAT, CAMPUS_LON);
  if (distance > ALLOWED_RADIUS) {
    throw new Error(`خارج النطاق الجغرافي المسموح به. مسافتك: ${Math.round(distance)} متر من الكلية.`);
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: decoded.scheduleId },
    include: { subject: true }
  });

  if (!schedule) {
    throw new Error('Schedule not found');
  }

  const now = new Date();
  const DAYS_MAP = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const todayDay = DAYS_MAP[now.getDay()];

  let status = 'PRESENT';
  if (schedule.dayOfWeek === todayDay) {
    const [schedHours, schedMins] = schedule.startTime.split(':').map(Number);
    const schedTimeInMinutes = schedHours * 60 + schedMins;
    const nowTimeInMinutes = now.getHours() * 60 + now.getMinutes();

    if (nowTimeInMinutes > schedTimeInMinutes + 15) {
      status = 'LATE';
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const record = await prisma.attendanceRecord.upsert({
    where: {
      studentId_scheduleId_date: {
        studentId: studentId,
        scheduleId: decoded.scheduleId,
        date: today
      }
    },
    update: {
      status,
      scannedAt: new Date()
    },
    create: {
      studentId: studentId,
      scheduleId: decoded.scheduleId,
      date: today,
      status,
      scannedAt: new Date()
    },
    include: {
      student: true
    }
  });

  // بث إشعار فوري عبر SSE لتحديث واجهة المحاضر تلقائياً
  broadcastSSE('ATTENDANCE_MARKED', {
    scheduleId: decoded.scheduleId,
    studentId: studentId,
    studentName: record.student.name,
    status: record.status,
    scannedAt: record.scannedAt
  });

  return record;
}

/**
 * معالجة وتوثيق حضور الطالب عبر التحديد الجغرافي الفعلي (GPS Check-In).
 * 
 * المنطق البرمجي والتدفق:
 * 1. التحقق من وجود الحصة المحددة في النظام.
 * 2. التحقق الجغرافي: حساب مسافة الطالب للتأكد من وجوده داخل محيط 150 متر من الكلية.
 * 3. التحقق من الزمان:
 *    - التأكد من مطابقة اليوم الحالي لليوم المجدول للحصة.
 *    - التأكد من أن توقيت التحضير يقع ضمن نافذة زمنية مرنة للمحاضرة (30 دقيقة قبل البدء وحتى 30 دقيقة بعد نهاية المحاضرة).
 * 4. مقارنة توقيت البدء الفعلي: إذا تأخر الطالب بأكثر من 15 دقيقة عن موعد بدء المحاضرة، تسجل الحالة متأخر (LATE)، وإلا فتسجل حاضر (PRESENT).
 * 5. حفظ وحقن البيانات في جدولي الحضور المتكاملين (AttendanceRecord و Attendance) لضمان التوافقية بين النظام التلقائي والتحضير اليدوي للمندوب.
 * 6. بث التحديث عبر قنوات الـ SSE وتنبيه الأنظمة المحيطة.
 * 
 * @param {number} studentId - المعرف الفريد للطالب.
 * @param {number} scheduleId - معرف الجدول الدراسي.
 * @param {number} latitude - خط العرض المكتشف من جهاز الطالب.
 * @param {number} longitude - خط الطول المكتشف من جهاز الطالب.
 * @returns {Promise<Object>} سجل الحضور المحدث أو الذي تم إنشاؤه.
 * @throws {Error} في حال كان الطالب خارج النطاق الجغرافي، أو في توقيت/يوم غير مطابق للحصة.
 */
async function gpsCheckIn(studentId, scheduleId, latitude, longitude) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: parseInt(scheduleId) },
    include: { subject: true, group: true }
  });

  if (!schedule) {
    throw new Error('Schedule not found');
  }

  const CAMPUS_LAT = 15.35;
  const CAMPUS_LON = 44.20;
  const ALLOWED_RADIUS = 150;

  if (latitude === undefined || longitude === undefined) {
    throw new Error('GPS coordinates (latitude/longitude) are required');
  }

  const distance = getCoordinateDistance(latitude, longitude, CAMPUS_LAT, CAMPUS_LON);
  if (distance > ALLOWED_RADIUS) {
    throw new Error(`أنت خارج النطاق الجغرافي للكلية. مسافتك الحالية: ${Math.round(distance)} متر من الكلية.`);
  }

  const now = new Date();
  const DAYS_MAP = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const todayDay = DAYS_MAP[now.getDay()];

  if (schedule.dayOfWeek !== todayDay) {
    throw new Error(`اليوم هو ${todayDay} والمحاضرة مجدولة ليوم ${schedule.dayOfWeek}.`);
  }

  const [startH, startM] = schedule.startTime.split(':').map(Number);
  const [endH, endM] = schedule.endTime.split(':').map(Number);
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;
  const nowTotal = now.getHours() * 60 + now.getMinutes();

  // السماح بالتحضير خلال نافذة ممتدة: 30 دقيقة قبل البدء وحتى 30 دقيقة بعد نهاية المحاضرة
  if (nowTotal < startTotal - 30 || nowTotal > endTotal + 30) {
    throw new Error(`المحاضرة تبدأ الساعة ${schedule.startTime} وتنتهي الساعة ${schedule.endTime}. الوقت الحالي خارج النطاق المسموح.`);
  }

  let status = 'PRESENT';
  if (nowTotal > startTotal + 15) {
    status = 'LATE';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1) التحديث في جدول AttendanceRecord (الخاص بمسح الـ QR والتحضير التلقائي)
  const record = await prisma.attendanceRecord.upsert({
    where: {
      studentId_scheduleId_date: {
        studentId: studentId,
        scheduleId: schedule.id,
        date: today
      }
    },
    update: {
      status,
      scannedAt: new Date()
    },
    create: {
      studentId: studentId,
      scheduleId: schedule.id,
      date: today,
      status,
      scannedAt: new Date()
    },
    include: {
      student: true
    }
  });

  // 2) التحديث في جدول Attendance (الخاص بتحضير المندوب اليدوي لضمان تناغم الجداول)
  const existingAttendance = await prisma.attendance.findFirst({
    where: {
      studentId: studentId,
      scheduleId: schedule.id,
      date: today
    }
  });

  if (existingAttendance) {
    await prisma.attendance.update({
      where: { id: existingAttendance.id },
      data: {
        status: status === 'LATE' ? 'PRESENT' : status,
        recordedById: studentId
      }
    });
  } else {
    await prisma.attendance.create({
      data: {
        studentId: studentId,
        scheduleId: schedule.id,
        date: today,
        status: status === 'LATE' ? 'PRESENT' : status,
        recordedById: studentId
      }
    });
  }

  broadcastSSE('ATTENDANCE_MARKED', {
    scheduleId: schedule.id,
    studentId: studentId,
    studentName: record.student.name,
    status: status,
    scannedAt: new Date()
  });

  return record;
}

/**
 * حساب إحصائيات الحضور والغياب الإجمالية للطالب.
 * 
 * @param {number} studentId - المعرف الفريد للطالب.
 * @returns {Promise<Object>} يحتوي على نسب وأعداد الحضور الفعلي، المتأخر، الغائب، والإجمالي.
 */
async function getAttendanceStatsSummary(studentId) {
  const records = await prisma.attendanceRecord.findMany({
    where: { studentId }
  });

  const total = records.length;
  const present = records.filter(r => r.status === 'PRESENT').length;
  const late = records.filter(r => r.status === 'LATE').length;
  const absent = records.filter(r => r.status === 'ABSENT').length;
  
  const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

  return {
    percentage,
    present,
    late,
    absent,
    total
  };
}

/**
 * تجميع إحصائيات الغياب والحضور للطالب مصنفة حسب كل مادة دراسية على حدة، وتحديد إنذارات الحرمان الأكاديمي.
 * 
 * المنطق البرمجي:
 * 1. استرجاع جميع سجلات الحضور المسجلة للطالب وربطها بالجدول والمادة.
 * 2. التجميع حسب رمز المادة الفريد (Subject Code).
 * 3. حساب نسبة الحضور (حاضر + معذور) ونسبة الغياب المئوية.
 * 4. تطبيق اللائحة الأكاديمية:
 *    - إذا تجاوزت نسبة الغياب 15%، يتم تفعيل علم الإنذار بالحرمان (hasWarning).
 *    - إذا تجاوزت نسبة الغياب 25%، يتم تفعيل علم الحرمان الأكاديمي الفعلي (hasDeprivation).
 * 
 * @param {number} studentId - المعرف الفريد للطالب.
 * @returns {Promise<Array<Object>>} مصفوفة تحتوي على إحصائيات المواد وحالة الحرمان.
 */
async function getAttendanceStatsBySubject(studentId) {
  const attendances = await prisma.attendance.findMany({
    where: { studentId },
    include: {
      schedule: {
        include: {
          subject: true
        }
      }
    }
  });

  const subjectStats = {};
  attendances.forEach(att => {
    const subject = att.schedule?.subject;
    if (!subject) return;

    if (!subjectStats[subject.code]) {
      subjectStats[subject.code] = {
        subjectName: subject.name,
        subjectCode: subject.code,
        presentCount: 0,
        absentCount: 0,
        excusedCount: 0,
        totalCount: 0
      };
    }

    subjectStats[subject.code].totalCount++;
    if (att.status === 'PRESENT') {
      subjectStats[subject.code].presentCount++;
    } else if (att.status === 'ABSENT') {
      subjectStats[subject.code].absentCount++;
    } else if (att.status === 'EXCUSED') {
      subjectStats[subject.code].excusedCount++;
    }
  });

  const statsList = Object.values(subjectStats).map(stat => {
    const presentAndExcused = stat.presentCount + stat.excusedCount;
    const presentPercent = stat.totalCount > 0 ? Math.round((presentAndExcused / stat.totalCount) * 100) : 100;
    const absenceRate = stat.totalCount > 0 ? (stat.absentCount / stat.totalCount) * 100 : 0;
    
    const hasWarning = absenceRate > 15;
    const hasDeprivation = absenceRate > 25;

    return {
      ...stat,
      presentPercent,
      absenceRate: Math.round(absenceRate),
      hasWarning,
      hasDeprivation
    };
  });

  return statsList;
}

module.exports = {
  getCoordinateDistance,
  scanCheckIn,
  gpsCheckIn,
  getAttendanceStatsSummary,
  getAttendanceStatsBySubject
};
