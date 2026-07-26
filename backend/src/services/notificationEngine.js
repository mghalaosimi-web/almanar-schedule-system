const { sendPushNotification, sendStudentPushNotification } = require('./notifications');
const { prisma } = require('../db');
const nodemailer = require('nodemailer');

// ── 1. TEMPLATES REGISTRY ───────────────────────────────────────────────────
const NOTIFICATION_TEMPLATES = {
  SCHEDULE_CHANGED: (data) => ({
    title: '📅 تعديل على الجدول الدراسي',
    body: `تم تعديل محاضرة [${data.subjectName || 'المادة'}] لتصبح في قاعة [${data.roomName || 'القاعة'}]`
  }),
  SCHEDULE_CANCELLED: (data) => ({
    title: '⚠️ إلغاء محاضرة',
    body: `تم إلغاء محاضرة [${data.subjectName || 'المادة'}] المقررة اليوم.`
  }),
  ATTENDANCE_RISK: (data) => ({
    title: '🚨 تنبيه نسبة الغياب',
    body: `تنبيه: نسبة حضورك حالياً هي ${data.attendanceRate}% في مادة [${data.subjectName || 'المادة'}]. يرجى الحذر لتجنب الحرمان.`
  }),
  EXAM_SCHEDULED: (data) => ({
    title: '📝 جدول الامتحان النهائي',
    body: `تم نشر موعد امتحان مادة [${data.subjectName || 'المادة'}] في قاعة [${data.roomName || 'القاعة'}] بتاريخ ${data.date || ''}`
  })
};

// ── 2. DELIVERY PROVIDERS ───────────────────────────────────────────────────

/**
 * Web Push Notification Provider
 */
async function pushProvider(targets, payload) {
  try {
    if (payload.studentId) {
      await sendStudentPushNotification(payload.studentId, payload);
    } else {
      await sendPushNotification(payload.groupId || null, payload);
    }
  } catch (err) {
    console.error('[NotificationEngine -> PushProvider] Failed:', err.message);
  }
}

/**
 * In-App DB Notification Log Provider
 */
async function internalDbProvider(recipients, payload) {
  try {
    if (!recipients || recipients.length === 0) return;

    const logs = recipients.map(r => ({
      studentId: r.id,
      groupId: r.groupId || null,
      title: payload.title || 'إشعار أكاديمي',
      message: payload.body || '',
      status: 'SENT'
    }));

    await prisma.notificationLog.createMany({ data: logs }).catch(() => {});
  } catch (err) {
    console.error('[NotificationEngine -> InternalDbProvider] Failed:', err.message);
  }
}

/**
 * Email Delivery Provider
 */
async function emailProvider(recipients, payload) {
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.log('[NotificationEngine -> EmailProvider] SMTP not configured. Skipping email dispatch.');
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const emails = recipients.map(r => r.email).filter(Boolean);
    if (emails.length === 0) return;

    await transporter.sendMail({
      from: `"نظام المنار الأكاديمي" <${process.env.SMTP_USER}>`,
      to: emails.join(','),
      subject: payload.title,
      text: payload.body,
      html: `<div style="font-family: Arial, sans-serif; direction: rtl; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb;">${payload.title}</h2>
        <p style="font-size: 16px; color: #334155;">${payload.body}</p>
        <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 20px 0;" />
        <small style="color: #64748b;">نظام إدارة الجدول الدراسي الجامعي — الكلية المنار</small>
      </div>`
    }).catch(e => console.warn('[EmailProvider] Transporter send error:', e.message));

  } catch (err) {
    console.error('[NotificationEngine -> EmailProvider] Error:', err.message);
  }
}

/**
 * WhatsApp / SMS Delivery Provider Stub
 */
async function whatsappProvider(recipients, payload) {
  console.log(`[NotificationEngine -> WhatsAppProvider] Dispatched message to ${recipients.length} target(s): "${payload.title}"`);
}

// ── 3. AUDIENCE RESOLVER ────────────────────────────────────────────────────
async function resolveAudience({ groupId, collegeId, studentId, role }) {
  if (studentId) {
    const student = await prisma.student.findUnique({ where: { id: parseInt(studentId) } });
    return student ? [student] : [];
  }

  if (groupId) {
    return await prisma.student.findMany({
      where: { groupId: parseInt(groupId) },
      select: { id: true, email: true, name: true, groupId: true }
    });
  }

  if (collegeId) {
    return await prisma.student.findMany({
      where: { collegeId: parseInt(collegeId) },
      select: { id: true, email: true, name: true, groupId: true }
    });
  }

  return [];
}

// ── 4. NOTIFICATION ENGINE CORE ─────────────────────────────────────────────
async function sendNotification({ templateKey, templateData, title, body, groupId, collegeId, studentId, channels = ['PUSH', 'INTERNAL'] }) {
  let finalTitle = title;
  let finalBody = body;

  if (templateKey && NOTIFICATION_TEMPLATES[templateKey]) {
    const rendered = NOTIFICATION_TEMPLATES[templateKey](templateData || {});
    finalTitle = rendered.title;
    finalBody = rendered.body;
  }

  const payload = {
    title: finalTitle || 'إشعار جديد',
    body: finalBody || '',
    groupId,
    studentId,
    url: '/student/home'
  };

  // 1. Resolve Target Audience
  const recipients = await resolveAudience({ groupId, collegeId, studentId });

  // 2. Dispatch to Selected Channels in Parallel
  const dispatchPromises = [];

  if (channels.includes('PUSH')) {
    dispatchPromises.push(pushProvider(recipients, payload));
  }
  if (channels.includes('INTERNAL')) {
    dispatchPromises.push(internalDbProvider(recipients, payload));
  }
  if (channels.includes('EMAIL')) {
    dispatchPromises.push(emailProvider(recipients, payload));
  }
  if (channels.includes('WHATSAPP')) {
    dispatchPromises.push(whatsappProvider(recipients, payload));
  }

  await Promise.allSettled(dispatchPromises);
  console.log(`[NotificationEngine] Dispatch complete for ${recipients.length} user(s) via channels: [${channels.join(', ')}]`);
}

module.exports = {
  sendNotification,
  resolveAudience,
  NOTIFICATION_TEMPLATES
};
