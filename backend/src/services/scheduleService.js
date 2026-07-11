/**
 * @file scheduleService.js
 * @description خدمة إدارة مواعيد الحصص الأكاديمية، التحقق من التعارضات، التعديلات الاستثنائية، وتصدير التقويم الأسبوعي.
 * @author أنتيجرافيتي (Antigravity)
 */

const { prisma } = require('../db');
const { broadcastSSE, sendPushNotification } = require('./notifications');

/**
 * فحص تعارض مواعيد الجدول الدراسي للتأكد من عدم حجز قاعة أو محاضر في نفس التوقيت المختار لحصة أخرى.
 * 
 * المنطق البرمجي:
 * - يبحث الاستعلام عن أي حصة أخرى في نفس اليوم (dayOfWeek) ونفس وقت البدء (startTime).
 * - يُصفي التعارض بناءً على معرف الكلية (collegeId) لمنع تضارب الخلايا المستقلة في الكليات الأخرى.
 * - يتخطى الفحص الحصص التي تنتمي لنفس المادة (subjectId) لتمكين الشعب المشتركة (Shared Classes) من الدراسة معاً في نفس القاعة.
 * - يُطلق العلم بالتعارض إذا تطابق المحاضر (lecturerName) أو القاعة (roomId) مع سجل نشط آخر.
 * 
 * @param {string} dayOfWeek - اليوم الأسبوعي بالإنجليزية (مثل SUNDAY).
 * @param {string} startTime - وقت البدء الفعلي (مثل 08:00).
 * @param {number} roomId - معرف القاعة الدراسية.
 * @param {string} lecturerName - اسم الدكتور المحاضر للحصة.
 * @param {number} collegeId - معرف الكلية التابع لها الجدول.
 * @param {number} subjectId - معرف المادة الأكاديمية.
 * @param {number} [excludeScheduleId] - معرف الحصة المراد استثناؤها من الفحص (في حالة التعديل).
 * @returns {Promise<Object|null>} يعيد كائن الحصة المتعارضة إن وُجدت، أو null في حال خلو الموعد من التعارضات.
 */
async function checkScheduleClash(dayOfWeek, startTime, roomId, lecturerName, collegeId, subjectId, excludeScheduleId) {
  const whereClause = {
    dayOfWeek,
    startTime,
    collegeId,
    subjectId: { not: subjectId }, // السماح بالمحاضرات المشتركة لنفس المادة
    OR: [
      { roomId },
      { lecturerName }
    ]
  };

  if (excludeScheduleId) {
    whereClause.id = { not: excludeScheduleId };
  }

  return prisma.schedule.findFirst({
    where: whereClause
  });
}

/**
 * إنشاء استثناء أو تعديل طارئ في موعد أو قاعة محاضرة معينة وتوجيه التنبيهات للشعبة.
 * 
 * التدفق البرمجي والمنطق:
 * 1. استرجاع بيانات الحصة الأساسية والتحقق من صحتها وصلاحية المشرف.
 * 2. التحقق من التعارض الجغرافي والزمني للموعد الاستثنائي المقترح لمنع التضارب.
 * 3. إدراج سجل استثناء جديد في جدول `ScheduleOverride` مرتبطاً بالتاريخ المحدد للحدث.
 * 4. إنشاء سجل تنبيه فوري موجه لطلاب الشعبة المعنية (`NotificationLog`) لحفظ التاريخ والمحافظة على الشفافية الأكاديمية.
 * 5. إرسال التحديث في الوقت الحقيقي للأجهزة المفتوحة عبر قنوات الـ SSE.
 * 6. دفع إشعار فوري (Push Notification) لهواتف الطلاب لتنبيههم بتعديل القاعة أو التوقيت.
 * 
 * @param {number} scheduleId - معرف الحصة الأساسية في الجدول.
 * @param {string} newStartTime - وقت البدء الجديد المقترح (اختياري).
 * @param {string} newEndTime - وقت الانتهاء الجديد المقترح (اختياري).
 * @param {number} newRoomId - معرف القاعة البديلة المقترحة (اختياري).
 * @param {string} date - التاريخ المحدد للاستثناء (مثل 2026-06-27).
 * @param {string} overrideType - نوع التعديل ('TEMPORARY' للمحاضرة القادمة فقط، أو 'PERMANENT').
 * @param {Object} userScope - نطاق صلاحيات المشرف المكتشفة من المصادقة.
 * @returns {Promise<Object>} كائن الاستثناء الذي تم إنشاؤه في قاعدة البيانات.
 * @throws {Error} في حال اكتشاف تعارض في الموعد البديل أو عدم وجود صلاحيات.
 */
async function createOverride(scheduleId, newStartTime, newEndTime, newRoomId, date, overrideType, userScope) {
  const schedule = await prisma.schedule.findFirst({
    where: {
      id: parseInt(scheduleId),
      ...userScope
    },
    include: { subject: true, group: true }
  });

  if (!schedule) {
    throw new Error('Schedule not found or unauthorized');
  }

  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dayOfWeek = days[new Date(date).getDay()];
  const targetRoomId = newRoomId ? parseInt(newRoomId) : schedule.roomId;
  const targetStartTime = newStartTime || schedule.startTime;

  // التحقق من التعارضات للموعد الجديد
  const clash = await checkScheduleClash(
    dayOfWeek,
    targetStartTime,
    targetRoomId,
    schedule.lecturerName,
    schedule.collegeId,
    schedule.subjectId,
    parseInt(scheduleId)
  );

  if (clash) {
    throw new Error('Conflict: Room or Lecturer already assigned to another class during this time slot.');
  }

  // حفظ الاستثناء في قاعدة البيانات
  const override = await prisma.scheduleOverride.create({
    data: {
      scheduleId: parseInt(scheduleId),
      newStartTime,
      newEndTime,
      newRoomId: newRoomId ? parseInt(newRoomId) : null,
      date: new Date(date),
      overrideType // 'TEMPORARY' أو 'PERMANENT'
    },
    include: {
      schedule: {
        include: { subject: true, group: true }
      }
    }
  });

  // صياغة نص التنبيه الموجه باللغة العربية
  const alertMessage = `تنبيه طارئ: تم تعديل محاضرة ${override.schedule.subject.name} الخاصة بـ ${override.schedule.group.name}. يرجى مراجعة الجدول المحدث.`;
  
  // حفظ سجل الإشعار بالدفعة
  await prisma.notificationLog.create({
    data: {
      groupId: override.schedule.groupId,
      message: alertMessage,
      status: 'PENDING'
    }
  });

  // إرسال تحديث SSE وبث الإشعار الفوري لهواتف الطلاب
  broadcastSSE('SCHEDULE_UPDATE', { scheduleId: override.scheduleId });
  sendPushNotification(override.schedule.groupId, {
    title: 'تعديل طارئ في الجدول',
    body: alertMessage,
    url: '/student/home'
  });

  return override;
}

/**
 * تصدير وتوليد ملف جدول المحاضرات بصيغة iCalendar (.ics) لتمكين الطالب من دمجه مع تقاويم الهواتف والأنظمة الخارجية.
 * 
 * المنطق الفني والتدفق:
 * 1. استرجاع بيانات الطالب وشعبته المسجل بها.
 * 2. جلب جميع المحاضرات الأسبوعية المجدولة للشعبة مع استعلام القاعات والمواد.
 * 3. صياغة الترويسات الرسمية لملف VCALENDAR متوافق مع معيار RFC 5545.
 * 4. حساب الفروقات الزمنية وتواريخ المحاضرات القادمة للأسبوع الحالي بناءً على الأيام الأسبوعية.
 * 5. تضمين الحلقات التكرارية (RRULE:FREQ=WEEKLY) لتكرار المحاضرة أسبوعياً تلقائياً في جهاز المستخدم.
 * 6. إرجاع السلسلة النصية المهيأة للإرسال كملف تقويم.
 * 
 * @param {number} studentId - المعرف الفريد للطالب المطلب التصدير له.
 * @returns {Promise<string>} السلسلة النصية المهيأة لملف الـ .ics.
 * @throws {Error} في حال عدم وجود الطالب أو عدم انتمائه لشعبة دراسية نشطة.
 */
async function exportScheduleToICS(studentId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId }
  });
  if (!student || !student.groupId) {
    throw new Error('Student or class group not found');
  }

  const schedules = await prisma.schedule.findMany({
    where: { groupId: student.groupId },
    include: {
      subject: true,
      room: true
    }
  });

  const now = new Date();
  const DAYS_MAP = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };

  const formatDateToICS = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}T${hh}${min}${ss}`;
  };

  const stamp = formatDateToICS(now);
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Manar Schedule System//Student Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  for (const sched of schedules) {
    const targetDayIdx = DAYS_MAP[sched.dayOfWeek];
    if (targetDayIdx === undefined) continue;

    const currentDayIndex = now.getDay();
    const diffDays = targetDayIdx - currentDayIndex;
    
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + diffDays);

    const [startH, startM] = sched.startTime.split(':').map(Number);
    const [endH, endM] = sched.endTime.split(':').map(Number);

    const startDate = new Date(targetDate);
    startDate.setHours(startH, startM, 0, 0);

    const endDate = new Date(targetDate);
    endDate.setHours(endH, endM, 0, 0);

    icsLines.push('BEGIN:VEVENT');
    icsLines.push(`UID:sched-${sched.id}@manar.edu`);
    icsLines.push(`DTSTAMP:${stamp}`);
    icsLines.push(`DTSTART:${formatDateToICS(startDate)}`);
    icsLines.push(`DTEND:${formatDateToICS(endDate)}`);
    icsLines.push(`SUMMARY:${sched.subject?.name || 'Class'} (${sched.subject?.code || ''})`);
    icsLines.push(`LOCATION:${sched.room?.name || 'N/A'}`);
    icsLines.push(`DESCRIPTION:Lecturer: ${sched.lecturerName || 'N/A'}\\nType: ${sched.subject?.type || ''}`);
    icsLines.push('RRULE:FREQ=WEEKLY');
    icsLines.push('END:VEVENT');
  }

  icsLines.push('END:VCALENDAR');

  return icsLines.join('\r\n');
}

module.exports = {
  checkScheduleClash,
  createOverride,
  exportScheduleToICS
};
