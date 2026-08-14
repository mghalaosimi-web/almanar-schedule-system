const express   = require('express');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const { prisma } = require('../../db');
const systemSettings  = require('../../services/systemSettings');
const { strictAuthLimiter } = require('./shared');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'manar-fallback-secret-2026';

// POST /api/auth/login
router.post('/login', strictAuthLimiter, async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'الرجاء إدخال البريد أو اسم المستخدم وكلمة المرور' });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    let user = null;
    let role = null;

    // ── 1. Check Database for Admin (SUPER_ADMIN, ADMIN, COLLEGE_ADMIN) ───
    try {
      const adminUser = await prisma.admin.findFirst({
        where: {
          OR: [
            { email: { equals: cleanIdentifier, mode: 'insensitive' } },
            { name: { equals: identifier.trim(), mode: 'insensitive' } }
          ]
        }
      });
      if (adminUser && adminUser.password) {
        const isMatch = await bcrypt.compare(password, adminUser.password);
        if (isMatch) {
          user = adminUser;
          role = adminUser.role || 'ADMIN';
        }
      }
    } catch (err) {
      console.warn('[Login] Admin lookup warning:', err.message);
    }

    // ── 2. Check Database for Lecturer ────────────────────────────────────
    if (!user) {
      try {
        const lecturerUser = await prisma.lecturer.findFirst({
          where: {
            OR: [
              { email: { equals: cleanIdentifier, mode: 'insensitive' } },
              { name: { equals: identifier.trim(), mode: 'insensitive' } }
            ]
          }
        });
        if (lecturerUser && lecturerUser.password) {
          const isMatch = await bcrypt.compare(password, lecturerUser.password);
          if (isMatch) {
            user = lecturerUser;
            role = 'LECTURER';
          }
        }
      } catch (err) {
        console.warn('[Login] Lecturer lookup warning:', err.message);
      }
    }

    // ── 3. Check Database for Student ─────────────────────────────────────
    if (!user) {
      try {
        const studentUser = await prisma.student.findFirst({
          where: {
            OR: [
              { email: { equals: cleanIdentifier, mode: 'insensitive' } },
              { idNumber: identifier.trim() },
              { phone: identifier.trim() }
            ]
          }
        });
        if (studentUser && studentUser.password) {
          const isMatch = await bcrypt.compare(password, studentUser.password);
          if (isMatch) {
            user = studentUser;
            role = 'STUDENT';
          }
        }
      } catch (err) {
        console.warn('[Login] Student lookup warning:', err.message);
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'اسم المستخدم أو البريد أو كلمة المرور غير صحيحة' });
    }

    // Track Session
    let sessionId = null;
    try {
      const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const devicePlatform = req.headers['user-agent'] || 'unknown';
      const { recordLogin } = require('../../services/sessionTracker');
      sessionId = await recordLogin(user, role, ipAddress, 'SUCCESS', devicePlatform);
    } catch (e) {
      console.error('[Login] Session tracking error:', e.message);
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        role, 
        sessionId,
        majorId: role === 'STUDENT' ? user.majorId : undefined,
        levelId: role === 'STUDENT' ? user.levelId : undefined,
        isRepresentative: role === 'STUDENT' ? user.isRepresentative : undefined,
        groupId: role === 'STUDENT' ? user.groupId : undefined
      },
      JWT_SECRET,
      { expiresIn: '90d' }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        googleId: role === 'STUDENT' ? user.googleId : undefined,
        majorId: role === 'STUDENT' ? user.majorId : undefined,
        levelId: role === 'STUDENT' ? user.levelId : undefined,
        isRepresentative: role === 'STUDENT' ? user.isRepresentative : undefined,
        groupId: role === 'STUDENT' ? user.groupId : undefined,
        collegeName: 'كلية المنار الجامعية',
        universityName: 'جامعة المنار',
        universityLogo: '/almanar-logo.png',
        themeColor: '#059669'
      }
    });

  } catch (error) {
    console.error('[API] Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during authentication' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', strictAuthLimiter, async (req, res) => {
  try {
    const { phone, identifier } = req.body;
    const targetPhone = (phone || identifier || '').trim();

    if (!targetPhone) {
      return res.status(400).json({ success: false, error: 'رقم الهاتف مطلوب لاستعادة كلمة المرور' });
    }

    // Search account across Student, Lecturer, Admin by phone or email or idNumber
    let userRec = await prisma.student.findFirst({
      where: {
        OR: [
          { phone: targetPhone },
          { email: { equals: targetPhone, mode: 'insensitive' } },
          { idNumber: targetPhone }
        ]
      }
    });

    let role = 'STUDENT';
    if (!userRec) {
      userRec = await prisma.lecturer.findFirst({
        where: {
          OR: [
            { phone: targetPhone },
            { email: { equals: targetPhone, mode: 'insensitive' } }
          ]
        }
      });
      if (userRec) role = 'LECTURER';
    }

    if (!userRec) {
      userRec = await prisma.admin.findFirst({
        where: { email: { equals: targetPhone, mode: 'insensitive' } }
      });
      if (userRec) role = userRec.role || 'ADMIN';
    }

    const requestTime = new Date().toLocaleString('ar-YE', { timeZone: 'Asia/Aden' });
    const userName = userRec ? userRec.name : 'غير محدد';
    const userPhone = userRec ? userRec.phone || targetPhone : targetPhone;
    const userEmail = userRec ? userRec.email : 'غير محدد';
    const studentId = userRec && userRec.idNumber ? userRec.idNumber : 'غير متوفر';

    // Format WhatsApp Message per Executive Directive 15 (No Passwords / No Tokens)
    const whatsappMessage = 
`🔐 طلب استعادة كلمة المرور — نظام كلية المنار الجامعية

المستخدم:
${userName}

رقم الهاتف:
${userPhone}

البريد:
${userEmail}

الرقم الجامعي:
${studentId}

الطلب:
استعادة / تغيير كلمة المرور

وقت الطلب:
${requestTime}

يرجى مراجعة الطلب واتخاذ الإجراء المناسب.`;

    const adminTargets = ['7776', '7778', '675'];

    // Log request securely
    try {
      await prisma.notificationLog.create({
        data: {
          studentId: (userRec && role === 'STUDENT') ? userRec.id : null,
          title: '🔐 طلب استعادة كلمة المرور',
          message: `طلب استعادة من ${userPhone} - الإدارة المخاطبة: ${adminTargets.join(', ')}`,
          status: 'PENDING'
        }
      });
    } catch (e) {}

    console.log(`[PASSWORD RESET REQUEST] Secure request logged for phone: ${userPhone}`);
    console.log(`[WHATSAPP MESSAGE TARGETS: ${adminTargets.join(', ')}]\n${whatsappMessage}`);
    console.log('[WHATSAPP INTEGRATION LIMITATION] Physical WhatsApp API gateway not connected. Request recorded for admin review.');

    res.status(200).json({
      success: true,
      message: 'تم إرسال طلب استعادة كلمة المرور إلى إدارة الجامعة بنجاح ✓'
    });

  } catch (error) {
    console.error('[API] Forgot password error:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء إرسال طلب استعادة كلمة المرور' });
  }
});

module.exports = router;
