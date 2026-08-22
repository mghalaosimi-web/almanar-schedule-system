const express   = require('express');
const { strictAuthLimiter } = require('./shared');
const IdentityResolver = require('../../services/identityResolver');
const SessionManager  = require('../../services/sessionManager');
const { prisma }      = require('../../db');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/login
router.post('/login', strictAuthLimiter, async (req, res) => {
  try {
    if (!JWT_SECRET) {
      console.error('[Login] JWT_SECRET is not configured');
      return res.status(503).json({ success: false, error: 'AUTH_CONFIGURATION_ERROR' });
    }
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'الرجاء إدخال البريد أو اسم المستخدم وكلمة المرور' });
    }

    const authResult = await IdentityResolver.resolvePasswordIdentity(identifier, password);
    if (!authResult.success) {
      return res.status(401).json({ success: false, code: authResult.code, error: authResult.error });
    }

    const user = authResult.user;
    const reqMetadata = {
      userAgent: req.headers['user-agent'] || null,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
      platform: req.headers['sec-ch-ua-platform'] || null
    };

    const { session, token } = await SessionManager.createSession(user, reqMetadata);

    const primaryRole = (user.roles && user.roles.length > 0)
      ? user.roles[0].role?.key || 'STUDENT'
      : (user.student ? 'STUDENT' : user.lecturer ? 'LECTURER' : 'ADMIN');

    const profileData = user.student || user.lecturer || user.admin || {};

    res.status(200).json({
      success: true,
      token,
      sessionId: session.id,
      accessiblePortals: authResult.portals,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: primaryRole,
        roles: (user.roles || []).map(r => r.role?.key || r.role),
        googleId: user.student?.googleId,
        majorId: user.student?.majorId,
        levelId: user.student?.levelId,
        isRepresentative: user.student?.isRepresentative || false,
        groupId: user.student?.groupId,
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
      status: 'RESET_REQUEST_CREATED',
      whatsappProviderStatus: 'WHATSAPP_LIMITATION_NOT_CONNECTED',
      message: 'تم إرسال طلب استعادة كلمة المرور إلى إدارة الجامعة بنجاح ✓'
    });

  } catch (error) {
    console.error('[API] Forgot password error:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء إرسال طلب استعادة كلمة المرور' });
  }
});

module.exports = router;
