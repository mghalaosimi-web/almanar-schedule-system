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
        email: user.email,
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


module.exports = router;
