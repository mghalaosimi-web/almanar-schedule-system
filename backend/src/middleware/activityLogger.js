const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { prisma } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
const LOGS_DIR = path.join(__dirname, '../../logs');
const LOGS_FILE = path.join(LOGS_DIR, 'activity.log');

// Ensure logs directory and file exist
try {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
} catch (err) {
  console.error('[ACTIVITY LOGGER] Failed to create logs directory:', err.message);
}

// Helper to write translated logs to the file
function writeLog(message) {
  try {
    const isoString = new Date().toISOString();
    const timestamp = new Date().toLocaleString('ar-YE', { timeZone: 'Asia/Aden' });
    const logLine = `${isoString} | [${timestamp}] ${message}\n`;
    fs.appendFileSync(LOGS_FILE, logLine, 'utf8');
    console.log(`[ACTIVITY] ${message}`);
  } catch (err) {
    console.warn('[ACTIVITY LOGGER] Failed to write log:', err.message);
  }
}

// Helper to get user context from JWT token in request headers
function getUserFromRequest(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Main Express middleware for logging actions
async function activityLogger(req, res, next) {
  const pathName = req.path;
  const method = req.method;

  // Process next middleware first so we can check response status codes
  res.on('finish', async () => {
    // We only log successful operations (200, 201, 202)
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    try {
      const user = getUserFromRequest(req) || req.user;

      // ── 1. LOG NEW REGISTRATIONS (POST /api/auth/register & complete-profile) ──
      if (pathName === '/api/auth/register' && method === 'POST') {
        const { fullName, email, collegeId, majorId, levelId, phone } = req.body;
        
        // Resolve names for beautiful logging
        let resolvedCollegeName = collegeId;
        let resolvedMajorName = majorId;
        
        // Count total students in this college
        let studentCount = 0;
        try {
          if (collegeId) {
            const collegeIdNum = parseInt(collegeId);
            if (!isNaN(collegeIdNum)) {
              const college = await prisma.college.findUnique({ where: { id: collegeIdNum } });
              if (college) resolvedCollegeName = college.name;
              studentCount = await prisma.student.count({ where: { collegeId: collegeIdNum } });
            }
          }
        } catch (e) {}

        writeLog(`[تسجيل جديد] انضمام الطالب الجديد '${fullName}' (البريد: ${email} · الهاتف: ${phone || 'غير محدد'}) إلى كلية '${resolvedCollegeName || 'غير محدد'}' - تخصص '${resolvedMajorName || 'العام'}'. إجمالي الطلاب في الكلية الآن: ${studentCount} طالب.`);
        return;
      }

      if (pathName === '/api/auth/complete-profile' && method === 'POST') {
        const { name, email, collegeId, majorId, phone } = req.body;
        let studentCount = 0;
        let resolvedCollegeName = collegeId;
        try {
          const collegeIdNum = parseInt(collegeId);
          if (!isNaN(collegeIdNum)) {
            const college = await prisma.college.findUnique({ where: { id: collegeIdNum } });
            if (college) resolvedCollegeName = college.name;
            studentCount = await prisma.student.count({ where: { collegeId: collegeIdNum } });
          }
        } catch (e) {}

        writeLog(`[إكمال ملف] المطور/الطالب '${name}' أكمل حسابه (البريد: ${email} · الهاتف: ${phone || 'غير محدد'}) في كلية '${resolvedCollegeName || 'غير محدد'}'. إجمالي الطلاب في الكلية الآن: ${studentCount} طالب.`);
        return;
      }

      // ── 2. LOG LOGINS (POST /api/auth/login & /api/auth/google) ──
      if (pathName === '/api/auth/login' && method === 'POST') {
        const { identifier } = req.body;
        writeLog(`[تسجيل دخول] تم الدخول للمستخدم ذو المعرّف '${identifier}' بنجاح.`);
        return;
      }

      // If user is authenticated, log their specific action
      if (user) {
        const userName = user.name;
        const userRole = user.role;
        const collegeId = user.collegeId;

        // Resolve college name if possible
        let collegeName = `الكلية المعرفة بالرقم ${collegeId}`;
        try {
          if (collegeId) {
            const college = await prisma.college.findUnique({ where: { id: parseInt(collegeId) } });
            if (college) collegeName = college.name;
          }
        } catch (e) {}

        // ── 3. LOG QR SCAN & GPS ATTENDANCE CHECK-INS ──
        if (pathName === '/api/attendance/scan' && method === 'POST') {
          writeLog(`[حضور QR] الطالب '${userName}' (${collegeName}) سجل حضوره للمحاضرة بنجاح عبر مسح كود الـ QR.`);
          return;
        }

        if (pathName === '/api/attendance/checkin' && method === 'POST') {
          const { scheduleId } = req.body;
          writeLog(`[حضور GPS] الطالب '${userName}' (${collegeName}) سجل حضوره للمحاضرة رقم '${scheduleId}' بنجاح عبر الفحص الجغرافي للـ GPS.`);
          return;
        }

        // ── 4. LOG DISCUSSION FORUM POSTS & COMMENTS ──
        if (pathName === '/api/exchange/posts' && method === 'POST') {
          const { title, category } = req.body;
          writeLog(`[منتدى الطلاب] الطالب '${userName}' أضاف منشوراً جديداً بعنوان '${title}' ضمن التصنيف '${category || 'عام'}'.`);
          return;
        }

        if (pathName.includes('/comments') && method === 'POST') {
          writeLog(`[منتدى الطلاب] الطالب '${userName}' أضاف تعليقاً جديداً على منشور زميله.`);
          return;
        }

        // ── 5. LOG FEEDBACK / SUGGESTIONS ──
        if (pathName === '/api/feedback' && method === 'POST') {
          const { category } = req.body;
          writeLog(`[اقتراح/ملاحظة] المستخدم '${userName}' (${userRole}) أرسل مقترحاً جديداً في تصنيف '${category}'.`);
          return;
        }

        // ── 6. LOG GENERAL APP NAVIGATION & QUERIES ──
        if (pathName === '/api/schedules' && method === 'GET') {
          writeLog(`[استعلام جدول] المستخدم '${userName}' (${userRole}) استعلم عن جدول المحاضرات الدراسي في كلية '${collegeName}'.`);
          return;
        }

        if (pathName === '/api/admin/logs' && method === 'GET') {
          writeLog(`[سجلات النظام] المسؤول '${userName}' (${userRole}) قام بالدخول لمشاهدة سجلات وتنبيهات النظام في كلية '${collegeName}'.`);
          return;
        }
      }
    } catch (err) {
      console.warn('[ACTIVITY LOGGER] Error inside logging handler:', err.message);
    }
  });

  next();
}

module.exports = { activityLogger, LOGS_FILE };
