const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { prisma } = require('../db');
const { verifyToken } = require('../middleware/auth');
const authenticateToken = verifyToken;
const systemSettings = require('../services/systemSettings');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// In-memory CAPTCHA and OTP challenge stores
const captchaStore = new Map();
const otpStore = new Map();

// Periodic cleanup of expired CAPTCHAs and OTP codes to prevent memory leaks (runs every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of captchaStore.entries()) {
    if (val.expires < now) {
      captchaStore.delete(key);
    }
  }
  for (const [key, val] of otpStore.entries()) {
    if (val.expires < now) {
      otpStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

// ⚠️ SECURITY: Configure VITE_GOOGLE_CLIENT_ID in .env — do NOT hardcode here
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
if (!GOOGLE_CLIENT_ID) {
  console.error('[GOOGLE AUTH] ⚠️  VITE_GOOGLE_CLIENT_ID is not set in environment variables. Google login will be disabled.');
}
const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 OTP requests per hour
  message: {
    success: false,
    error: 'Too many OTP requests from this IP, please try again after an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Google Verification Helper
async function verifyGoogleToken(token) {
  if (!token) {
    return { verified: false, error: 'Token is missing' };
  }
  if (token.startsWith('mock_token_for_')) {
    if (process.env.NODE_ENV !== 'development') {
      return { verified: false, error: 'Mock tokens are only allowed in development environment' };
    }
    const parts = token.substring('mock_token_for_'.length).split('_');
    const email = parts[0];
    const name = parts[1] ? decodeURIComponent(parts[1]) : email.split('@')[0];
    return { googleId: 'mock_google_id_' + email, email, name, verified: true };
  }

  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || payload.given_name || payload.email.split('@')[0],
      picture: payload.picture,
      verified: true
    };
  } catch (err) {
    console.warn('[GOOGLE VERIFY] JWT verification failed, attempting fallback userinfo query:', err.message);
    return new Promise((resolve) => {
      const https = require('https');
      const options = {
        hostname: 'www.googleapis.com',
        path: '/oauth2/v3/userinfo',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };

      https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.email) {
              resolve({
                googleId: parsed.sub,
                email: parsed.email,
                name: parsed.name || parsed.given_name || parsed.email.split('@')[0],
                picture: parsed.picture,
                verified: true
              });
            } else {
              resolve({ verified: false, error: parsed.error_description || 'Invalid token' });
            }
          } catch (e) {
            resolve({ verified: false, error: 'Failed to parse Google verification response' });
          }
        });
      }).on('error', (netErr) => {
        console.error('[GOOGLE VERIFY] Fallback network error:', netErr);
        resolve({ verified: false, error: 'Google verification network error' });
      });
    });
  }
}

// 1. POST /api/auth/login
router.post('/login', strictAuthLimiter, async (req, res) => {
  try {
    const { identifier, password, collegeId } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Identifier (Name/Email/ID) and password are required' });
    }

    let user = null;
    let role = null;

    try {
      // Check Admin first
      const adminUser = await prisma.admin.findFirst({
        where: {
          OR: [
            { email: identifier },
            { name: identifier }
          ]
        }
      });
      if (adminUser) {
        if (adminUser.role !== 'SUPER_ADMIN' && collegeId && adminUser.collegeId !== parseInt(collegeId)) {
          return res.status(401).json({ success: false, error: 'User does not belong to the selected college' });
        }
        if (adminUser.password) {
          const isMatch = await bcrypt.compare(password, adminUser.password);
          if (isMatch) {
            user = adminUser;
            role = adminUser.role;
          }
        }
      }

      if (!user) {
        // Check Lecturer
        const lecturerUser = await prisma.lecturer.findFirst({
          where: {
            OR: [
              { email: identifier },
              { name: identifier }
            ]
          }
        });
        if (lecturerUser) {
          if (collegeId && lecturerUser.collegeId !== parseInt(collegeId)) {
            return res.status(401).json({ success: false, error: 'User does not belong to the selected college' });
          }
          if (lecturerUser.password) {
            const isMatch = await bcrypt.compare(password, lecturerUser.password);
            if (isMatch) {
              user = lecturerUser;
              role = 'LECTURER';
            }
          }
        }
      }

      if (!user) {
        // Check Student
        const studentUser = await prisma.student.findFirst({
          where: {
            OR: [
              { email: identifier },
              { idNumber: identifier }
            ]
          }
        });
        if (studentUser && studentUser.password) {
          if (collegeId && studentUser.collegeId !== parseInt(collegeId)) {
            return res.status(401).json({ success: false, error: 'User does not belong to the selected college' });
          }
          const isMatch = await bcrypt.compare(password, studentUser.password);
          if (isMatch) {
            user = studentUser;
            role = 'STUDENT';
          }
        }
      }
    } catch (dbError) {
      console.warn('Database connection error:', dbError.message);
    }

    if (!user) {
      try {
        const filePath = path.join(__dirname, '../../data/fallback_metadata.json');
        if (fs.existsSync(filePath)) {
          const fallback = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (fallback && fallback.users) {
            // Check admins
            const fallbackAdmin = fallback.users.admins.find(
              a => (a.email === identifier || a.name === identifier) && a.passwordRaw === password
            );
            if (fallbackAdmin) {
              user = fallbackAdmin;
              role = fallbackAdmin.role;
            }

            if (!user) {
              // Check lecturers
              const fallbackLecturer = fallback.users.lecturers.find(
                l => (l.email === identifier || l.name === identifier) && l.passwordRaw === password
              );
              if (fallbackLecturer) {
                user = fallbackLecturer;
                role = 'LECTURER';
              }
            }

            if (!user) {
              // Check students
              const fallbackStudent = fallback.users.students.find(
                s => (s.email === identifier || s.idNumber === identifier) && s.passwordRaw === password
              );
              if (fallbackStudent) {
                user = fallbackStudent;
                role = 'STUDENT';
              }
            }
          }
        }
      } catch (err) {
        console.error('[OFFLINE FALLBACK] Fallback login check error:', err);
      }
    }

    if (!user) {
      try {
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const devicePlatform = req.headers['user-agent'] || 'unknown';
        const { recordLogin } = require('../services/sessionTracker');
        await recordLogin({ email: identifier }, role || 'UNKNOWN', ipAddress, 'FAILED', devicePlatform);
      } catch (err) {}
      return res.status(401).json({ success: false, error: 'Invalid name, email, ID or password' });
    }

    const enforceGoogle = systemSettings.get('requireGoogleLink') !== false;
    if (role === 'STUDENT' && !user.googleId && enforceGoogle) {
      try {
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const devicePlatform = req.headers['user-agent'] || 'unknown';
        const { recordLogin } = require('../services/sessionTracker');
        await recordLogin(user, role, ipAddress, 'FAILED_GOOGLE_LINK', devicePlatform);
      } catch (err) {}
      return res.status(200).json({
        success: true,
        requiresGoogleLink: true,
        email: user.email,
        message: 'Student account authenticated. Google account linking required.'
      });
    }

    const userCollegeId = user.collegeId || null;
    let collegeName = null;
    let universityName = null;
    let universityLogo = null;
    let themeColor = null;

    if (userCollegeId) {
      try {
        const college = await prisma.college.findUnique({
          where: { id: userCollegeId },
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
      } catch (dbErr) {
        console.warn('Database error while fetching user college details:', dbErr.message);
        try {
          const filePath = path.join(__dirname, '../../data/fallback_metadata.json');
          if (fs.existsSync(filePath)) {
            const fallback = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const college = fallback.colleges.find(c => c.id === userCollegeId);
            if (college) {
              collegeName = college.name;
              const university = fallback.universities.find(u => u.id === college.universityId);
              if (university) {
                universityName = university.name;
                universityLogo = university.slug === 'hajjah-university' ? '/hajjah-logo-new.png' :
                                 university.slug === 'almanar-college' ? '/almanar-logo.png' : university.logoUrl;
                themeColor = university.themeColor;
              }
            }
          }
        } catch (err) {}
      }
    }

    // Call session activity tracker to create DB SessionLog row
    let sessionId = null;
    try {
      const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const devicePlatform = req.headers['user-agent'] || 'unknown';
      const { recordLogin } = require('../services/sessionTracker');
      sessionId = await recordLogin(user, role, ipAddress, 'SUCCESS', devicePlatform);
    } catch (e) {
      console.error('[Login] Session tracking error:', e.message);
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        name: user.name, 
        role, 
        sessionId,
        majorId: role === 'STUDENT' ? user.majorId : undefined,
        levelId: role === 'STUDENT' ? user.levelId : undefined,
        isRepresentative: role === 'STUDENT' ? user.isRepresentative : undefined,
        groupId: role === 'STUDENT' ? user.groupId : undefined,
        collegeId: userCollegeId,
        universityId: user.universityId || undefined
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
        collegeId: userCollegeId,
        universityId: user.universityId || undefined,
        collegeName,
        universityName,
        universityLogo,
        themeColor
      }
    });

  } catch (error) {
    console.error('[API] Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during authentication' });
  }
});

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

// 4. POST /api/auth/complete-profile
// PATCH [SEC]: verifyToken added — requires valid Google session before allowing profile creation
router.post('/complete-profile', authenticateToken, async (req, res) => {
  try {
    const { email, name, phone, idNumber, collegeId, majorId, levelId } = req.body;
    
    if (!name || !phone || !collegeId || !majorId || !levelId) {
      return res.status(400).json({ success: false, error: 'All profile fields are required' });
    }

    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length < 3) {
      return res.status(400).json({ success: false, error: 'يجب إدخال الاسم الثلاثي أو الرباعي على الأقل' });
    }

    const suffix = phone.replace('+967', '');
    if (suffix.length !== 9 || !/^\d+$/.test(suffix)) {
      return res.status(400).json({ success: false, error: 'رقم الهاتف يجب أن يتكون من 9 أرقام بعد الرمز الدولي' });
    }

    if (idNumber && idNumber.trim() !== '') {
      if (!/^\d+$/.test(idNumber.trim()) || idNumber.trim().length < 5) {
        return res.status(400).json({ success: false, error: 'الرقم الجامعي يجب أن يتكون من أرقام فقط ولا يقل عن 5 خانات' });
      }
    }

    const resolvedId = (idNumber && idNumber.trim() !== '') ? idNumber.trim() : 'TEMP_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const studentId = req.user.id;
    const existingStudent = await prisma.student.findUnique({ where: { id: studentId } });
    if (!existingStudent) {
      return res.status(404).json({ success: false, error: 'Student account not found' });
    }

    if (idNumber && idNumber.trim() !== '' && idNumber.trim() !== existingStudent.idNumber) {
      const existingIdNumber = await prisma.student.findUnique({ where: { idNumber: resolvedId } });
      if (existingIdNumber && existingIdNumber.id !== studentId) {
        return res.status(400).json({ success: false, error: 'A student with this academic ID already exists' });
      }
    }

    const updateData = {
      name,
      phone,
      idNumber: resolvedId,
      collegeId: parseInt(collegeId),
      majorId: parseInt(majorId),
      levelId: parseInt(levelId),
      isEmailVerified: true,
      isPhoneVerified: true
    };
    if (email) updateData.email = email;

    const student = await prisma.student.update({
      where: { id: studentId },
      data: updateData
    });

    let collegeName = null;
    let universityName = null;
    let universityLogo = null;
    let themeColor = null;

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

    res.status(201).json({
      success: true,
      token,
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        role: 'STUDENT',
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
    console.error('[API] Complete profile error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'A student with this academic ID or phone already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to complete profile' });
  }
});

// 5. POST /api/auth/send-otp
router.post('/send-otp', otpLimiter, async (req, res) => {
  try {
    const { phone, email } = req.body;
    if (!phone || !email) {
      return res.status(400).json({ success: false, error: 'Phone number and email are required' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(phone, { code: otpCode, expires: Date.now() + 5 * 60 * 1000 });

    console.log('[OTP SYSTEM] Verification code generated for:', email);

    // Never log the OTP code itself in production — use email delivery only

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        const mailOptions = {
          from: `"كلية المنار الجامعية" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'رمز التحقق الخاص بك (OTP)',
          text: `أهلاً بك في كلية المنار الجامعية.\n\nرمز التحقق الخاص بك هو: ${otpCode}\n\nيرجى عدم مشاركة هذا الرمز مع أي شخص. الرمز صالح لمدة 5 دقائق.\n\nAl-Manar University College`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right; color: #333; max-width: 500px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
              <div style="background-color: #84cc16; padding: 20px; text-align: center;">
                <h2 style="color: #fff; margin: 0;">كلية المنار الجامعية</h2>
              </div>
              <div style="padding: 20px;">
                <p>أهلاً بك،</p>
                <p>رمز التحقق الخاص بك هو:</p>
                <div style="text-align: center; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: bold; background-color: #f3f4f6; padding: 10px 20px; border-radius: 8px; letter-spacing: 5px;">${otpCode}</span>
                </div>
                <p style="color: #666; font-size: 13px;">يرجى عدم مشاركة هذا الرمز مع أي شخص. الرمز صالح لمدة 5 دقائق.</p>
              </div>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[OTP SYSTEM] 📧 Email sent successfully to ${email}`);
      } catch (emailErr) {
        console.error('[OTP SYSTEM] ❌ Failed to send email:', emailErr.message);
      }
    }

    res.status(200).json({ success: true, message: 'OTP generated successfully' });
  } catch (err) {
    console.error('[OTP] Failed to generate OTP:', err);
    res.status(500).json({ success: false, error: 'Failed to generate OTP' });
  }
});

// 6. GET /api/auth/captcha
router.get('/captcha', (req, res) => {
  const challengeId = Math.random().toString(36).substring(2, 15);
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const answer = num1 + num2;

  captchaStore.set(challengeId, { answer, expires: Date.now() + 5 * 60 * 1000 });

  res.status(200).json({
    success: true,
    challengeId,
    question: `What is ${num1} + ${num2}?`
  });
});

// 7. POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    if (systemSettings.get('maintenanceMode')) {
      return res.status(503).json({ success: false, error: 'Registration is temporarily disabled due to system maintenance.' });
    }

    const {
      fullName, email, password, phone, idNumber, idPhotoUrl,
      majorId, levelId, collegeId, captchaAnswer, captchaChallengeId, otpCode, googleIdToken
    } = req.body;

    if (!fullName || !email || !phone || !majorId || !levelId || !collegeId) {
      return res.status(400).json({ success: false, error: 'Name, email, phone, and academic selections are required' });
    }

    const nameParts = fullName.trim().split(/\s+/);
    if (nameParts.length < 3) {
      return res.status(400).json({ success: false, error: 'يجب إدخال الاسم الثلاثي أو الرباعي على الأقل' });
    }

    const suffix = phone.replace('+967', '');
    if (suffix.length !== 9 || !/^\d+$/.test(suffix)) {
      return res.status(400).json({ success: false, error: 'رقم الهاتف يجب أن يتكون من 9 أرقام بعد الرمز الدولي' });
    }

    if (idNumber && idNumber.trim() !== '') {
      if (!/^\d+$/.test(idNumber.trim()) || idNumber.trim().length < 5) {
        return res.status(400).json({ success: false, error: 'الرقم الجامعي يجب أن يتكون من أرقام فقط ولا يقل عن 5 خانات' });
      }
    }

    const resolvedId = (idNumber && idNumber.trim() !== '') ? idNumber.trim() : 'TEMP_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6).toUpperCase();

    // Verify CAPTCHA if provided
    if (captchaChallengeId || captchaAnswer) {
      const storedCaptcha = captchaStore.get(captchaChallengeId);
      if (!storedCaptcha) {
        return res.status(400).json({ success: false, error: 'كود التحقق البشري غير صالح أو منتهي الصلاحية' });
      }
      if (storedCaptcha.expires < Date.now()) {
        captchaStore.delete(captchaChallengeId);
        return res.status(400).json({ success: false, error: 'كود التحقق البشري منتهي الصلاحية' });
      }
      if (parseInt(captchaAnswer) !== storedCaptcha.answer) {
        return res.status(400).json({ success: false, error: 'إجابة التحقق البشري غير صحيحة' });
      }
      captchaStore.delete(captchaChallengeId); // single-use
    }

    // Verify OTP if provided
    if (otpCode) {
      const storedOtp = otpStore.get(phone);
      if (!storedOtp) {
        return res.status(400).json({ success: false, error: 'رمز التحقق (OTP) غير موجود أو غير صالح' });
      }
      if (storedOtp.expires < Date.now()) {
        otpStore.delete(phone);
        return res.status(400).json({ success: false, error: 'رمز التحقق (OTP) منتهي الصلاحية' });
      }
      if (otpCode !== storedOtp.code) {
        return res.status(400).json({ success: false, error: 'رمز التحقق (OTP) غير صحيح' });
      }
      otpStore.delete(phone); // single-use
    }

    let isGoogleVerified = false;
    let verifiedEmail = email;

    if (googleIdToken) {
      const verification = await verifyGoogleToken(googleIdToken);
      if (verification.verified) {
        isGoogleVerified = true;
        verifiedEmail = verification.email;
      } else {
        return res.status(401).json({ success: false, error: verification.error || 'Google token verification failed' });
      }
    }

    if (!isGoogleVerified) {
      return res.status(400).json({ success: false, error: 'Registration via email and password is disabled. Students must link their official university Google account to proceed.' });
    }

    let resolvedCollegeId = parseInt(collegeId);
    if (isNaN(resolvedCollegeId)) {
      const queryName = String(collegeId);
      const college = await prisma.college.findFirst({
        where: {
          OR: [
            { slug: queryName },
            { name: queryName },
            ...(queryName === 'بوابة الطالب الجامعي' ? [{ slug: 'almanar-main' }, { name: 'كلية المنار الجامعية' }] : [])
          ]
        }
      });
      if (!college) {
        return res.status(400).json({ success: false, error: 'Could not resolve selected College name/slug' });
      }
      resolvedCollegeId = college.id;
    }

    let resolvedMajorId = parseInt(majorId);
    if (isNaN(resolvedMajorId)) {
      const major = await prisma.major.findFirst({
        where: { name: String(majorId) }
      });
      if (!major) {
        return res.status(400).json({ success: false, error: 'Could not resolve selected Major name' });
      }
      resolvedMajorId = major.id;
    }

    let resolvedLevelId = parseInt(levelId);
    if (isNaN(resolvedLevelId)) {
      const level = await prisma.level.findFirst({
        where: { name: String(levelId) }
      });
      if (!level) {
        return res.status(400).json({ success: false, error: 'Could not resolve selected Level name' });
      }
      resolvedLevelId = level.id;
    }

    const existingStudent = await prisma.student.findFirst({
      where: { email: { equals: verifiedEmail, mode: 'insensitive' } }
    });
    if (existingStudent) {
      return res.status(400).json({ success: false, error: 'Email address is already registered' });
    }

    const existingPhone = await prisma.student.findUnique({ where: { phone } });
    if (existingPhone) {
      return res.status(400).json({ success: false, error: 'Phone number is already registered' });
    }

    const existingIdNumber = await prisma.student.findUnique({ where: { idNumber: resolvedId } });
    if (existingIdNumber) {
      return res.status(400).json({ success: false, error: 'ID Number is already registered' });
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const student = await prisma.student.create({
      data: {
        name: fullName,
        email: verifiedEmail,
        password: hashedPassword,
        googleId: isGoogleVerified ? verification.googleId : null,
        phone,
        idNumber: resolvedId,
        idPhotoUrl: idPhotoUrl || null,
        collegeId: resolvedCollegeId,
        majorId: resolvedMajorId,
        levelId: resolvedLevelId,
        isEmailVerified: true,
        isPhoneVerified: true
      }
    });

    const token = jwt.sign(
      { id: student.id, name: student.name, role: 'STUDENT', groupId: student.groupId, collegeId: student.collegeId },
      JWT_SECRET,
      { expiresIn: '90d' }
    );

    // Call session activity tracker
    try {
      const { recordLogin } = require('../services/sessionTracker');
      recordLogin(student, 'STUDENT');
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: 'Student registered and logged in successfully.',
      token,
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        role: 'STUDENT',
        groupId: student.groupId,
        collegeId: student.collegeId
      }
    });

  } catch (error) {
    console.error('[API] Registration error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during registration' });
  }
});

// 8. POST /api/auth/verify
router.post('/verify', async (req, res) => {
  try {
    const { identifier, code, type } = req.body;

    if (!identifier || !code || !type) {
      return res.status(400).json({ success: false, error: 'Identifier, code, and verification type are required' });
    }

    if (type !== 'EMAIL' && type !== 'PHONE') {
      return res.status(400).json({ success: false, error: 'Invalid verification type' });
    }

    let student;
    if (type === 'EMAIL') {
      student = await prisma.student.findUnique({ where: { email: identifier } });
    } else {
      student = await prisma.student.findUnique({ where: { phone: identifier } });
    }

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student record not found' });
    }

    const validCode = await prisma.verificationCode.findFirst({
      where: {
        studentId: student.id,
        code,
        type,
        expiresAt: { gte: new Date() }
      }
    });

    if (!validCode) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code' });
    }

    await prisma.verificationCode.delete({ where: { id: validCode.id } });

    const updateData = type === 'EMAIL' ? { isEmailVerified: true } : { isPhoneVerified: true };
    const updatedStudent = await prisma.student.update({
      where: { id: student.id },
      data: updateData
    });

    if (updatedStudent.isEmailVerified && updatedStudent.isPhoneVerified) {
      const token = jwt.sign(
        { id: updatedStudent.id, name: updatedStudent.name, role: 'STUDENT', groupId: updatedStudent.groupId },
        JWT_SECRET,
        { expiresIn: '90d' }
      );

      return res.status(200).json({
        success: true,
        verified: true,
        message: 'Account fully verified and activated.',
        token,
        user: {
          id: updatedStudent.id,
          name: updatedStudent.name,
          email: updatedStudent.email,
          role: 'STUDENT',
          groupId: updatedStudent.groupId
        }
      });
    }

    res.status(200).json({
      success: true,
      verified: false,
      message: `${type} verification completed. Pending remaining step.`
    });

  } catch (error) {
    console.error('[API] Verification error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during verification' });
  }
});

// 9. POST /api/auth/impersonate
router.post('/impersonate', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Forbidden: Developer God Mode is reserved for Super Admins only' });
    }

    const { studentId, lecturerId, adminId } = req.body;

    if (studentId) {
      const student = await prisma.student.findUnique({
        where: { id: parseInt(studentId) },
        include: { group: true }
      });
      if (!student) {
        return res.status(404).json({ success: false, error: 'Student not found' });
      }

      // Impersonation log
      try {
        const { recordImpersonate } = require('../services/sessionTracker');
        recordImpersonate(req.user.name, req.user.email, student.name, student.email, 'STUDENT');
      } catch (e) {}

      const token = jwt.sign(
        { 
          id: student.id, 
          name: student.name, 
          role: 'STUDENT', 
          groupId: student.groupId,
          collegeId: student.collegeId,
          isRepresentative: student.isRepresentative,
          googleId: student.googleId || 'impersonated'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: student.id,
          name: student.name,
          email: student.email,
          role: 'STUDENT',
          groupId: student.groupId,
          groupName: student.group ? student.group.name : '',
          collegeId: student.collegeId,
          isRepresentative: student.isRepresentative,
          googleId: student.googleId || 'impersonated'
        }
      });
    }

    if (lecturerId) {
      const lecturer = await prisma.lecturer.findUnique({
        where: { id: parseInt(lecturerId) }
      });
      if (!lecturer) {
        return res.status(404).json({ success: false, error: 'Lecturer not found' });
      }

      // Impersonation log
      try {
        const { recordImpersonate } = require('../services/sessionTracker');
        recordImpersonate(req.user.name, req.user.email, lecturer.name, lecturer.email, 'LECTURER');
      } catch (e) {}

      const token = jwt.sign(
        { 
          id: lecturer.id, 
          name: lecturer.name, 
          role: 'LECTURER',
          collegeId: lecturer.collegeId,
          universityId: lecturer.universityId
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: lecturer.id,
          name: lecturer.name,
          email: lecturer.email,
          role: 'LECTURER',
          collegeId: lecturer.collegeId,
          universityId: lecturer.universityId
        }
      });
    }

    if (adminId) {
      const admin = await prisma.admin.findUnique({
        where: { id: parseInt(adminId) }
      });
      if (!admin) {
        return res.status(404).json({ success: false, error: 'Admin not found' });
      }

      // Impersonation log
      try {
        const { recordImpersonate } = require('../services/sessionTracker');
        recordImpersonate(req.user.name, req.user.email, admin.name, admin.email, admin.role);
      } catch (e) {}

      const token = jwt.sign(
        { 
          id: admin.id, 
          name: admin.name, 
          role: admin.role,
          collegeId: admin.collegeId,
          universityId: admin.universityId
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          collegeId: admin.collegeId,
          universityId: admin.universityId
        }
      });
    }

    return res.status(400).json({ success: false, error: 'Student ID, Lecturer ID, or Admin ID is required for impersonation' });

  } catch (error) {
    console.error('[API] Impersonation error:', error);
    res.status(500).json({ success: false, error: 'Failed to impersonate user' });
  }
});

// GET /api/auth/system/settings
// NOTE: This endpoint is intentionally public (used by StudentDashboard/AttendanceScanner before auth).
// PATCH [SEC]: We strip 'deactivatedColleges' from the public response — that list is
// operational/internal data that must NOT be disclosed to unauthenticated callers.
router.get('/system/settings', (req, res) => {
  const systemSettings = require('../services/systemSettings');
  const allSettings = systemSettings.getAll();
  // eslint-disable-next-line no-unused-vars
  const { deactivatedColleges, ...publicSettings } = allSettings;
  res.status(200).json({ success: true, settings: publicSettings });
});

// 10. POST /api/auth/logout
router.post('/logout', verifyToken, (req, res) => {
  try {
    const { recordLogout } = require('../services/sessionTracker');
    recordLogout(req.user);
  } catch (e) {}
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// 11. POST /api/auth/link-google
router.post('/link-google', verifyToken, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Google ID Token is required' });
    }

    const verification = await verifyGoogleToken(idToken);
    if (!verification.verified) {
      return res.status(401).json({ success: false, error: verification.error || 'Google token verification failed' });
    }

    const { googleId, email: googleEmail } = verification;
    
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Only student accounts can link Google authentication.' });
    }

    const duplicate = await prisma.student.findUnique({
      where: { googleId }
    });

    if (duplicate) {
      return res.status(400).json({ success: false, error: 'This Google account is already linked to another student account.' });
    }

    const updatedStudent = await prisma.student.update({
      where: { id: req.user.id },
      data: { googleId }
    });

    const token = jwt.sign(
      { 
        id: updatedStudent.id, 
        name: updatedStudent.name, 
        role: 'STUDENT', 
        majorId: updatedStudent.majorId,
        levelId: updatedStudent.levelId,
        isRepresentative: updatedStudent.isRepresentative,
        groupId: updatedStudent.groupId,
        collegeId: updatedStudent.collegeId
      },
      JWT_SECRET,
      { expiresIn: '90d' }
    );

    res.status(200).json({
      success: true,
      message: 'Google account linked successfully!',
      token,
      user: {
        id: updatedStudent.id,
        name: updatedStudent.name,
        email: updatedStudent.email,
        role: 'STUDENT',
        googleId: updatedStudent.googleId,
        majorId: updatedStudent.majorId,
        levelId: updatedStudent.levelId,
        isRepresentative: updatedStudent.isRepresentative,
        groupId: updatedStudent.groupId,
        collegeId: updatedStudent.collegeId
      }
    });

  } catch (error) {
    console.error('[API] Link Google error:', error);
    res.status(500).json({ success: false, error: 'Failed to link Google account' });
  }
});

module.exports = router;
