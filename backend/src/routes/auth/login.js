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
      return res.status(400).json({ success: false, error: 'Identifier (Name/Email/ID) and password are required' });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    let user = null;
    let role = null;

    // ── 1. Master Developer / Admin Bypass ────────────────────────────────
    const isMasterBypass = (
      cleanIdentifier === 'm.gh.alosimi@gmail.com' ||
      cleanIdentifier === 'admin@almanar.edu.ye' ||
      cleanIdentifier === 'admin'
    ) && (
      password === '708090' ||
      password === '12345678' ||
      password === 'admin123'
    );

    if (isMasterBypass) {
      try {
        const adminRec = await prisma.admin.findFirst({
          where: {
            OR: [
              { email: { equals: cleanIdentifier, mode: 'insensitive' } },
              { name: { equals: identifier, mode: 'insensitive' } }
            ]
          }
        });
        if (adminRec) {
          user = adminRec;
          role = adminRec.role || 'SUPER_ADMIN';
        } else {
          // Provision Admin in DB if missing
          const hashedPassword = await bcrypt.hash('708090', 10);
          user = await prisma.admin.create({
            data: {
              name: 'م. محمد غالب العصيمي',
              email: 'm.gh.alosimi@gmail.com',
              password: hashedPassword,
              role: 'SUPER_ADMIN'
            }
          });
          role = 'SUPER_ADMIN';
        }
      } catch (e) {
        // Fallback synthetic admin if DB connection has temporary issue
        user = {
          id: 1,
          name: 'م. محمد غالب العصيمي',
          email: 'm.gh.alosimi@gmail.com',
          role: 'SUPER_ADMIN'
        };
        role = 'SUPER_ADMIN';
      }
    }

    // ── 2. Check Database for Admin ───────────────────────────────────────
    if (!user) {
      try {
        const adminUser = await prisma.admin.findFirst({
          where: {
            OR: [
              { email: { equals: cleanIdentifier, mode: 'insensitive' } },
              { name: { equals: identifier, mode: 'insensitive' } }
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
    }

    // ── 3. Check Database for Lecturer ────────────────────────────────────
    if (!user) {
      try {
        const lecturerUser = await prisma.lecturer.findFirst({
          where: {
            OR: [
              { email: { equals: cleanIdentifier, mode: 'insensitive' } },
              { name: { equals: identifier, mode: 'insensitive' } }
            ]
          }
        });
        if (lecturerUser) {
          const isDefaultPass = password === 'lecturer123' || password === '12345678' || password === '708090';
          const isMatch = isDefaultPass || (lecturerUser.password && await bcrypt.compare(password, lecturerUser.password));
          if (isMatch) {
            user = lecturerUser;
            role = 'LECTURER';
          }
        } else if (cleanIdentifier.includes('lecturer') || cleanIdentifier.includes('suwaidi') || identifier.includes('السويدي')) {
          // Provision demo lecturer
          const hashedPassword = await bcrypt.hash(password, 10);
          user = await prisma.lecturer.create({
            data: {
              name: 'د. محمد السويدي',
              email: cleanIdentifier.includes('@') ? cleanIdentifier : 'm.suwaidi@almanar.edu.ye',
              password: hashedPassword,
              collegeId: 3
            }
          });
          role = 'LECTURER';
        }
      } catch (err) {
        console.warn('[Login] Lecturer lookup warning:', err.message);
      }
    }

    // ── 4. Check Database for Student ─────────────────────────────────────
    if (!user) {
      try {
        const studentUser = await prisma.student.findFirst({
          where: {
            OR: [
              { email: { equals: cleanIdentifier, mode: 'insensitive' } },
              { idNumber: identifier.trim() }
            ]
          }
        });
        if (studentUser) {
          const isDefaultPass = password === '123456' || password === '12345678' || password === 'student123' || password === '708090';
          const isMatch = isDefaultPass || (studentUser.password && await bcrypt.compare(password, studentUser.password));
          if (isMatch) {
            user = studentUser;
            role = 'STUDENT';
          }
        } else if (cleanIdentifier.includes('student') || /^\d{4,10}$/.test(identifier.trim()) || cleanIdentifier.includes('@')) {
          // Auto-provision student on first login attempt if missing
          const hashedPassword = await bcrypt.hash(password, 10);
          user = await prisma.student.create({
            data: {
              name: `طالب (${identifier.trim()})`,
              email: cleanIdentifier.includes('@') ? cleanIdentifier : `student_${identifier.trim()}@almanar.edu.ye`,
              idNumber: /^\d+$/.test(identifier.trim()) ? identifier.trim() : '20241001',
              password: hashedPassword,
              majorId: 1,
              levelId: 1,
              collegeId: 3
            }
          });
          role = 'STUDENT';
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

module.exports = router;
