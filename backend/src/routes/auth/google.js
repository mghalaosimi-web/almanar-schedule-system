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
const IdentityResolver = require('../../services/identityResolver');
const SessionManager  = require('../../services/sessionManager');

// Helper function to process verified Google identity
async function handleVerifiedGoogleAuth(req, res, verification) {
  const authResult = await IdentityResolver.resolveGoogleIdentity(verification);
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

  return res.status(200).json({
    success: true,
    status: 'PROFILE_COMPLETE',
    token,
    sessionId: session.id,
    accessiblePortals: authResult.portals,
    user: {
      id: user.id,
      name: user.displayName,
      email: user.email,
      role: primaryRole,
      roles: (user.roles || []).map(r => r.role?.key || r.role),
      googleId: user.student?.googleId || verification.googleId,
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
}

// 2. POST /api/auth/google
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { credential } = req.body;
    const token = credential || req.body.idToken;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Google credential JWT is required' });
    }

    const verification = await verifyGoogleToken(token);
    if (!verification.verified) {
      return res.status(401).json({ success: false, error: verification.error || 'Google token verification failed' });
    }

    await handleVerifiedGoogleAuth(req, res, verification);

  } catch (error) {
    console.error('[API] Native Google auth error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during Google authentication' });
  }
});

// 3. POST /api/auth/google-login
router.post('/google-login', authLimiter, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Google ID Token is required' });
    }

    const verification = await verifyGoogleToken(idToken);
    if (!verification.verified) {
      return res.status(401).json({ success: false, error: verification.error || 'Google token verification failed' });
    }

    await handleVerifiedGoogleAuth(req, res, verification);

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
      const { recordLogin } = require('../../services/sessionTracker');
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
