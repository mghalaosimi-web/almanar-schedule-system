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
// Helper function to process verified Google identity
async function handleVerifiedGoogleAuth(req, res, verification) {
  const { email, name, googleId } = verification;
  const collegeIdInput = req.body.collegeId;

  const matches = [];

  // 1. Search by googleId across all models (Student, Lecturer, Admin)
  if (googleId) {
    const studentByGId = await prisma.student.findUnique({
      where: { googleId },
      include: { group: true }
    });
    if (studentByGId) matches.push({ user: studentByGId, role: 'STUDENT', matchedBy: 'googleId' });

    const lecturerByGId = await prisma.lecturer.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } } // Lecturer model currently uses email
    });
    if (lecturerByGId && !matches.some(m => m.user.email.toLowerCase() === lecturerByGId.email.toLowerCase())) {
      // Checked via email for lecturer
    }

    const adminByGId = await prisma.admin.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    });
    if (adminByGId && !matches.some(m => m.user.email.toLowerCase() === adminByGId.email.toLowerCase())) {
      // Checked via email for admin
    }
  }

  // 2. Search by verified email across Student, Lecturer, Admin if not found by googleId
  if (matches.length === 0 && email) {
    const studentsByEmail = await prisma.student.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { group: true }
    });
    for (const s of studentsByEmail) {
      matches.push({ user: s, role: 'STUDENT', matchedBy: 'email' });
    }

    const lecturersByEmail = await prisma.lecturer.findMany({
      where: { email: { equals: email, mode: 'insensitive' } }
    });
    for (const l of lecturersByEmail) {
      matches.push({ user: l, role: 'LECTURER', matchedBy: 'email' });
    }

    const adminsByEmail = await prisma.admin.findMany({
      where: { email: { equals: email, mode: 'insensitive' } }
    });
    for (const a of adminsByEmail) {
      matches.push({ user: a, role: a.role || 'ADMIN', matchedBy: 'email' });
    }
  }

  // Handle Ambiguous Match (Multiple conflicting accounts for same verified identity)
  if (matches.length > 1) {
    console.warn(`[GoogleAuth] Ambiguous identity match detected for email: ${email} (Count: ${matches.length})`);
    return res.status(200).json({
      success: false,
      code: 'AMBIGUOUS_IDENTITY',
      status: 'AMBIGUOUS_ACCOUNT',
      error: 'تم العثور على أكثر من حساب مرتبط بهذا البريد الإلكتروني. يرجى التواصل مع إدارة الجامعة.'
    });
  }

  // Handle No Match (New Account)
  if (matches.length === 0) {
    return res.status(200).json({
      success: false,
      code: 'ACCOUNT_NOT_FOUND',
      status: 'NEW_ACCOUNT',
      error: 'لا يوجد لديك حساب حتى الآن',
      googleData: { email, name, googleId }
    });
  }

  let { user, role, matchedBy } = matches[0];

  // Auto-link googleId on verified email match for Student
  if (matchedBy === 'email' && googleId && role === 'STUDENT' && !user.googleId) {
    user = await prisma.student.update({
      where: { id: user.id },
      data: { googleId },
      include: { group: true }
    });
  }

  if (collegeIdInput && user.collegeId && user.collegeId !== parseInt(collegeIdInput)) {
    return res.status(401).json({ success: false, error: 'User does not belong to the selected college' });
  }

  // Check Profile Completeness (Rule 5 & Rule 6)
  const missingFields = [];
  if (role === 'STUDENT') {
    if (!user.name || user.name.trim().length < 2 || user.name.includes('TEMP_')) missingFields.push('name');
    if (!user.phone || user.phone.trim().length < 6) missingFields.push('phone');
    if (!user.collegeId) missingFields.push('collegeId');
    if (!user.majorId) missingFields.push('majorId');
    if (!user.levelId) missingFields.push('levelId');
  }

  const isProfileComplete = missingFields.length === 0;

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
      email: user.email,
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

  try {
    const { recordLogin } = require('../../services/sessionTracker');
    recordLogin(user, role);
  } catch (e) {}

  if (isProfileComplete) {
    return res.status(200).json({
      success: true,
      status: 'PROFILE_COMPLETE',
      token: systemToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role,
        googleId: role === 'STUDENT' ? user.googleId : undefined,
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
  } else {
    return res.status(200).json({
      success: true,
      status: 'PROFILE_INCOMPLETE',
      missingFields,
      token: systemToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role,
        collegeId: user.collegeId || null,
        majorId: user.majorId || null,
        levelId: user.levelId || null,
        collegeName
      }
    });
  }
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
