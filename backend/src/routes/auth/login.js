const express   = require('express');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const { prisma } = require('../../db');
const systemSettings  = require('../../services/systemSettings');
const { strictAuthLimiter } = require('./shared');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/login
router.post('/login', strictAuthLimiter, async (req, res) => {
  try {
    const { identifier, password } = req.body;
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
      if (adminUser && adminUser.password) {
        const isMatch = await bcrypt.compare(password, adminUser.password);
        if (isMatch) {
          user = adminUser;
          role = adminUser.role;
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
        if (lecturerUser && lecturerUser.password) {
          const isMatch = await bcrypt.compare(password, lecturerUser.password);
          if (isMatch) {
            user = lecturerUser;
            role = 'LECTURER';
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
      return res.status(401).json({ success: false, error: 'Invalid name, email, ID or password' });
    }

    const enforceGoogle = systemSettings.get('requireGoogleLink') !== false;
    if (role === 'STUDENT' && !user.googleId && enforceGoogle) {
      return res.status(200).json({
        success: true,
        requiresGoogleLink: true,
        email: user.email,
        message: 'Student account authenticated. Google account linking required.'
      });
    }

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

module.exports = router;
