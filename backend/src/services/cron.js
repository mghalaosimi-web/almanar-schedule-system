const cron = require('node-cron');
const { prisma } = require('../db');
const { sendPushNotification } = require('./notifications');

async function sendDailyScheduleSummary() {
  console.log('[CRON] Executing 8:00 PM Daily Schedule Summary for all groups...');
  try {
    // 1. Determine tomorrow's day of week
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const tomorrowDayName = days[tomorrow.getDay()];

    // Start and end of tomorrow for date comparison
    const tomorrowStart = new Date(tomorrow);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Fetch all colleges
    const colleges = await prisma.college.findMany();
    let totalGroupsProcessed = 0;

    for (const college of colleges) {
      // Fetch all groups with tomorrow's schedules and overrides pre-joined for this college
      const groups = await prisma.group.findMany({
        where: { collegeId: college.id },
        include: {
          schedules: {
            where: {
              dayOfWeek: tomorrowDayName
            },
            include: {
              subject: true,
              room: true,
              overrides: {
                where: {
                  date: {
                    gte: tomorrowStart,
                    lte: tomorrowEnd
                  }
                },
                include: {
                  newRoom: true
                }
              }
            }
          }
        }
      });

      totalGroupsProcessed += groups.length;

      for (const group of groups) {
        const tomorrowClasses = [];

        for (const schedule of group.schedules) {
          const override = schedule.overrides[0]; // Matches at most 1 override due to the date filter

          let startTime = schedule.startTime;
          let endTime = schedule.endTime;
          let roomName = schedule.room.name;

          if (override) {
            startTime = override.newStartTime || startTime;
            endTime = override.newEndTime || endTime;
            roomName = override.newRoom ? override.newRoom.name : roomName;
          }

          tomorrowClasses.push({
            subject: schedule.subject.name,
            code: schedule.subject.code,
            lecturer: schedule.lecturerName,
            startTime,
            endTime,
            room: roomName,
            isOverride: !!override
          });
        }

        let messageAr = '';
        let messageEn = '';

        if (tomorrowClasses.length > 0) {
          messageEn = `Tomorrow's Schedule Summary for ${group.name}:\n`;
          messageAr = `ملخص جدول الغد لشعبة ${group.name}:\n`;

          tomorrowClasses.forEach((c, idx) => {
            messageEn += `${idx + 1}. ${c.subject} (${c.code}) with Dr. ${c.lecturer} in Room ${c.room} [${c.startTime} - ${c.endTime}]${c.isOverride ? ' (UPDATED)' : ''}\n`;
            messageAr += `${idx + 1}. ${c.subject} (${c.code}) مع د. ${c.lecturer} في قاعة ${c.room} [${c.startTime} - ${c.endTime}]${c.isOverride ? ' (تم التحديث)' : ''}\n`;
          });
        } else {
          messageEn = `No classes scheduled for tomorrow for ${group.name}. Enjoy your day off!`;
          messageAr = `لا توجد محاضرات مجدولة للغد لشعبة ${group.name}. استمتع بيومك!`;
        }

        // Combine messages
        const alertMessage = `${messageAr}\n${messageEn}`;

        await prisma.notificationLog.create({
          data: {
            groupId: group.id,
            message: alertMessage,
            status: 'SENT',
            sentTime: new Date()
          }
        });

        // Send daily summary push notification
        sendPushNotification(group.id, {
          title: `جدول الغد - ${group.name}`,
          body: messageAr || messageEn,
          url: '/student/home'
        });
      }
    }

    // 2. Also process any other PENDING notifications and set their status to SENT
    const pendingNotifications = await prisma.notificationLog.findMany({
      where: { status: 'PENDING' }
    });

    for (const log of pendingNotifications) {
      console.log(`[CRON] Dispatching alert message to Group ID ${log.groupId || 'All'}: "${log.message}"`);

      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: 'SENT', sentTime: new Date() }
      });
    }

    console.log(`[CRON] Daily notifications and summaries processed successfully. Groups: ${totalGroupsProcessed}, Pending: ${pendingNotifications.length}`);
  } catch (error) {
    console.error('[CRON] Error processing daily notifications:', error);
  }
}

async function sendMorningCheckin() {
  console.log('[CRON] Executing 8:00 AM Morning Check-in for all groups...');
  try {
    const groups = await prisma.group.findMany();
    for (const group of groups) {
      const messageAr = `صباح الخير! كيف حالك اليوم؟ نتمنى لك يوماً دراسياً موفقاً. لا تنسَ التحقق من جدول محاضراتك لليوم.`;
      const messageEn = `Good morning! How are you today? We wish you a successful academic day. Don't forget to check your schedule for today.`;
      const alertMessage = `${messageAr}\n${messageEn}`;

      await prisma.notificationLog.create({
        data: {
          groupId: group.id,
          message: alertMessage,
          status: 'SENT',
          sentTime: new Date()
        }
      });

      sendPushNotification(group.id, {
        title: `صباح الخير ☀️`,
        body: messageAr,
        url: '/student/home'
      });
    }
    console.log(`[CRON] Morning check-in processed for ${groups.length} groups.`);
  } catch (error) {
    console.error('[CRON] Error processing morning check-in:', error);
  }
}

async function sendAfternoonCheckin() {
  console.log('[CRON] Executing 3:00 PM Afternoon Check-in for all groups...');
  try {
    const groups = await prisma.group.findMany();
    for (const group of groups) {
      const messageAr = `مساء الخير! كيف كانت محاضراتك اليوم؟ نتمنى أنك استمتعت واستفدت.`;
      const messageEn = `Good afternoon! How were your lectures today? We hope you enjoyed and benefited.`;
      const alertMessage = `${messageAr}\n${messageEn}`;

      await prisma.notificationLog.create({
        data: {
          groupId: group.id,
          message: alertMessage,
          status: 'SENT',
          sentTime: new Date()
        }
      });

      sendPushNotification(group.id, {
        title: `كيف كانت محاضراتك اليوم؟ 🤔`,
        body: messageAr,
        url: '/student/home'
      });
    }
    console.log(`[CRON] Afternoon check-in processed for ${groups.length} groups.`);
  } catch (error) {
    console.error('[CRON] Error processing afternoon check-in:', error);
  }
}

async function checkUpcomingClassesAndNotify() {
  console.log('[CRON] Checking for upcoming classes starting in 30 minutes...');
  try {
    const now = new Date();
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDayName = days[now.getDay()];

    const schedules = await prisma.schedule.findMany({
      where: { dayOfWeek: currentDayName },
      include: { subject: true, room: true, group: true }
    });

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const schedule of schedules) {
      const [sHours, sMinutes] = schedule.startTime.split(':').map(Number);
      const scheduleMinutes = sHours * 60 + sMinutes;

      // Trigger window: 24–31 minutes before lecture start.
      // The extra ±1 min on each side compensates for cron drift on hosted
      // platforms (Render free tier, Railway) where */5 min jobs can fire 1-2 min late.
      const diff = scheduleMinutes - currentMinutes;
      if (diff >= 24 && diff <= 31) {
        // Prevent double sending
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const existingLog = await prisma.notificationLog.findFirst({
          where: {
            groupId: schedule.groupId,
            message: { contains: `تبدأ محاضرة ${schedule.subject.name} بعد 30 دقيقة` },
            sentTime: { gte: oneHourAgo }
          }
        });

        if (!existingLog) {
          const messageAr = `تذكير: تبدأ محاضرة ${schedule.subject.name} للشعبة ${schedule.group.name} بعد 30 دقيقة (الساعة ${schedule.startTime}) في قاعة ${schedule.room.name}.`;
          const messageEn = `Reminder: Lecture ${schedule.subject.name} for group ${schedule.group.name} starts in 30 minutes (${schedule.startTime}) in Room ${schedule.room.name}.`;
          const alertMessage = `${messageAr}\n${messageEn}`;

          await prisma.notificationLog.create({
            data: {
              groupId: schedule.groupId,
              message: alertMessage,
              status: 'SENT',
              sentTime: new Date()
            }
          });

          sendPushNotification(schedule.groupId, {
            title: `تذكير بمحاضرة ⏰`,
            body: messageAr,
            url: '/student/home'
          });

          console.log(`[CRON] Sent 30-minute reminder for class: ${schedule.subject.name} (Group: ${schedule.group.name})`);
        }
      }
    }
  } catch (error) {
    console.error('[CRON] Error checking upcoming classes:', error);
  }
}

function initializeCronJobs() {
  const YEMEN_TZ = { timezone: 'Asia/Aden' }; // UTC+3 — توقيت صنعاء / عدن

  // Schedule: Runs every day at 8:00 AM Yemen time (Morning Check-in)
  cron.schedule('0 8 * * *', sendMorningCheckin, YEMEN_TZ);

  // Schedule: Runs every day at 3:00 PM Yemen time (Afternoon Check-in)
  cron.schedule('0 15 * * *', sendAfternoonCheckin, YEMEN_TZ);

  // Schedule: Runs every day at 8:00 PM Yemen time (Daily Schedule Summary)
  cron.schedule('0 20 * * *', sendDailyScheduleSummary, YEMEN_TZ);

  // Schedule: Runs every 5 minutes (Upcoming lectures check) — timezone independent
  cron.schedule('*/5 * * * *', checkUpcomingClassesAndNotify);

  console.log('[CRON] Smart Notification Engine initialized — timezone: Asia/Aden (UTC+3)');
}

module.exports = {
  initializeCronJobs,
  sendDailyScheduleSummary,
  sendMorningCheckin,
  sendAfternoonCheckin,
  checkUpcomingClassesAndNotify
};
