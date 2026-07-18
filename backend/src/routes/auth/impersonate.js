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
