const express   = require('express');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const { prisma } = require('../../db');
const { verifyToken } = require('../../middleware/auth');
const systemSettings  = require('../../services/systemSettings');
const {
  captchaStore, otpStore,
  authLimiter, otpLimiter, strictAuthLimiter,
  verifyGoogleToken,
} = require('./shared');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
// 2. POST /api/auth/google
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { credential, collegeId } = req.body;
    const token = credential || req.body.idToken;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Google credential JWT is required' });
    }

    const verification = await verifyGoogleToken(token);
    if (!verification.verified) {
      return res.status(401).json({ success: false, error: verification.error || 'Google token verification failed' });
    }

    const { email, name, googleId } = verification;

    let user = null;
    if (googleId) {
      user = await prisma.student.findUnique({
        where: { googleId },
        include: { group: true }
      });
    }
    if (!user) {
      user = await prisma.student.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: { group: true }
      });
      if (user && googleId && !user.googleId) {
        // Auto-link Google ID on successful email match
        user = await prisma.student.update({
          where: { id: user.id },
          data: { googleId },
          include: { group: true }
        });
      }
    }
    let role = 'STUDENT';

    if (!user) {
      user = await prisma.lecturer.findUnique({ where: { email } });
      if (user) role = 'LECTURER';
    }

    if (!user) {
      user = await prisma.admin.findUnique({ where: { email } });
      if (user) role = user.role;
    }

    if (!user) {
      return res.status(403).json({
        success: false,
        code: 'GOOGLE_NOT_LINKED',
        error: 'حساب جوجل هذا غير مربوط بأي حساب جامعي. يرجى تسجيل الدخول بالبريد الجامعي أولاً لربط الحساب.'
      });
    }

    if (collegeId && user.collegeId && user.collegeId !== parseInt(collegeId)) {
      return res.status(401).json({ success: false, error: 'User does not belong to the selected college' });
    }

    let collegeName = null;
    let universityName = null;
    let universityLogo = null;
    let themeColor = null;

    if (user.collegeId) {
      const college = await prisma.college.findUnique({
        where: { id: user.collegeId },
        include: { university: true }
      });
      if (college) {
        collegeName = college.name;
        if (college.university) {
          universityName = college.university.name;
          universityLogo = college.university.slug === 'hajjah-university' ? '/hajjah-logo-new.png' :
                           college.university.slug === 'almanar-college' ? '/almanar-logo.png' : college.university.logoUrl;
          themeColor = college.university.themeColor;
        }
      }
    }

    const systemToken = jwt.sign(
      { 
        id: user.id, 
        name: user.name, 
        role, 
        majorId: role === 'STUDENT' ? user.majorId : undefined,
        levelId: role === 'STUDENT' ? user.levelId : undefined,
        isRepresentative: role === 'STUDENT' ? user.isRepresentative : undefined,
        groupId: role === 'STUDENT' ? user.groupId : undefined,
        collegeId: user.collegeId,
        universityId: user.universityId || undefined
      },
      JWT_SECRET,
      { expiresIn: '90d' }
    );

    // Call session activity tracker
    try {
      const { recordLogin } = require('../services/sessionTracker');
      recordLogin(user, role);
    } catch (e) {}

    res.status(200).json({
      success: true,
      token: systemToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        majorId: role === 'STUDENT' ? user.majorId : undefined,
        levelId: role === 'STUDENT' ? user.levelId : undefined,
        isRepresentative: role === 'STUDENT' ? user.isRepresentative : undefined,
        groupId: role === 'STUDENT' ? user.groupId : undefined,
        collegeId: user.collegeId,
        universityId: user.universityId || undefined,
        collegeName,
        universityName,
        universityLogo,
        themeColor
      }
    });

  } catch (error) {
    console.error('[API] Native Google auth error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during Google authentication' });
  }
});

// 3. POST /api/auth/google-login
router.post('/google-login', authLimiter, async (req, res) => {
  try {
    const { idToken, collegeId } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Google ID Token is required' });
    }

    const verification = await verifyGoogleToken(idToken);
    if (!verification.verified) {
      return res.status(401).json({ success: false, error: verification.error || 'Google token verification failed' });
    }

    const { email, name, googleId } = verification;

    let student = null;
    if (googleId) {
      student = await prisma.student.findUnique({
        where: { googleId }
      });
    }
    if (!student) {
      student = await prisma.student.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
      });
      if (student && googleId && !student.googleId) {
        student = await prisma.student.update({
          where: { id: student.id },
          data: { googleId }
        });
      }
    }

    if (!student) {
      return res.status(403).json({
        success: false,
        code: 'GOOGLE_NOT_LINKED',
        error: 'حساب جوجل هذا غير مربوط بأي حساب جامعي. يرجى تسجيل الدخول بالبريد الجامعي أولاً لربط الحساب.'
      });
    }

    if (collegeId && student.collegeId !== parseInt(collegeId)) {
      return res.status(401).json({ success: false, error: 'Student does not belong to the selected college' });
    }

    let collegeName = null;
    let universityName = null;
    let universityLogo = null;
    let themeColor = null;

    if (student.collegeId) {
      const college = await prisma.college.findUnique({
        where: { id: student.collegeId },
        include: { university: true }
      });
      if (college) {
        collegeName = college.name;
        if (college.university) {
          universityName = college.university.name;
          universityLogo = college.university.slug === 'hajjah-university' ? '/hajjah-logo-new.png' :
                           college.university.slug === 'almanar-college' ? '/almanar-logo.png' : college.university.logoUrl;
          themeColor = college.university.themeColor;
        }
      }
    }

    const token = jwt.sign(
      { 
        id: student.id, 
        name: student.name, 
        role: 'STUDENT', 
        majorId: student.majorId, 
        levelId: student.levelId, 
        isRepresentative: student.isRepresentative, 
        collegeId: student.collegeId 
      },
      JWT_SECRET,
      { expiresIn: '90d' }
    );

    // Call session activity tracker
    try {
      const { recordLogin } = require('../services/sessionTracker');
      recordLogin(student, 'STUDENT');
    } catch (e) {}

    res.status(200).json({
      success: true,
      token,
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        role: 'STUDENT',
        googleId: student.googleId,
        majorId: student.majorId,
        levelId: student.levelId,
        isRepresentative: student.isRepresentative,
        collegeId: student.collegeId,
        collegeName,
        universityName,
        universityLogo,
        themeColor
      }
    });

  } catch (error) {
    console.error('[API] Google login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during Google login' });
  }
});

// 4. POST /api/auth/link-google
router.post('/link-google', authLimiter, async (req, res) => {
  try {
    let email = req.body.email;
    const credential = req.body.credential || req.body.idToken;

    if (!email && req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.id) {
          const studentRec = await prisma.student.findUnique({
            where: { id: decoded.id }
          });
          if (studentRec) {
            email = studentRec.email;
          }
        }
      } catch (err) {
        console.warn('JWT verification failed during link-google:', err.message);
      }
    }

    if (!email || !credential) {
      return res.status(400).json({ success: false, error: 'Email and Google credential are required' });
    }

    const verification = await verifyGoogleToken(credential);
    if (!verification.verified) {
      return res.status(401).json({ success: false, error: verification.error || 'Google token verification failed' });
    }

    const { googleId } = verification;

    let student = await prisma.student.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student account not found.' });
    }

    const existingLink = await prisma.student.findUnique({
      where: { googleId }
    });
    if (existingLink && existingLink.id !== student.id) {
      return res.status(400).json({ success: false, error: 'حساب جوجل هذا مرتبط بطالب آخر بالفعل.' });
    }

    student = await prisma.student.update({
      where: { id: student.id },
      data: { googleId },
      include: { group: true }
    });

    const systemToken = jwt.sign(
      { 
        id: student.id, 
        name: student.name, 
        role: 'STUDENT', 
        majorId: student.majorId,
        levelId: student.levelId,
        isRepresentative: student.isRepresentative,
        groupId: student.groupId,
        collegeId: student.collegeId,
        universityId: student.universityId || undefined
      },
      JWT_SECRET,
      { expiresIn: '90d' }
    );

    let collegeName = null;
    let universityName = null;
    let universityLogo = null;
    let themeColor = null;

    if (student.collegeId) {
      const college = await prisma.college.findUnique({
        where: { id: student.collegeId },
        include: { university: true }
      });
      if (college) {
        collegeName = college.name;
        if (college.university) {
          universityName = college.university.name;
          universityLogo = college.university.slug === 'hajjah-university' ? '/hajjah-logo-new.png' :
                           college.university.slug === 'almanar-college' ? '/almanar-logo.png' : college.university.logoUrl;
          themeColor = college.university.themeColor;
        }
      }
    }

    try {
      const { recordLogin } = require('../services/sessionTracker');
      recordLogin(student, 'STUDENT');
    } catch (e) {}

    res.status(200).json({
      success: true,
      token: systemToken,
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        role: 'STUDENT',
        googleId: student.googleId,
        majorId: student.majorId,
        levelId: student.levelId,
        isRepresentative: student.isRepresentative,
        groupId: student.groupId,
        collegeId: student.collegeId,
        universityId: student.universityId || undefined,
        collegeName,
        universityName,
        universityLogo,
        themeColor
      }
    });

  } catch (error) {
    console.error('[API] Link Google error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during Google linking' });
  }
});


module.exports = router;
