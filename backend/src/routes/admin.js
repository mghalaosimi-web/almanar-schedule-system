const express = require('express');
const bcrypt = require('bcryptjs');
const xlsx = require('xlsx');
const { prisma } = require('../db');
const { verifyToken, isSuperAdmin } = require('../middleware/auth');
const { broadcastSSE, sendPushNotification } = require('../services/notifications');

// استيراد الخدمات المفككة لإدارة منطق العمليات الإدارية الثقيلة
const adminService = require('../services/adminService');
const excelParserService = require('../services/excelParserService');
const scheduleService = require('../services/scheduleService');

const router = express.Router();

/**
 * التحقق من رتبة وصلاحيات المستخدم الإدارية (محلياً بالتفويض للخدمة).
 */
function isAuthorizedAdmin(req) {
  return adminService.isAuthorizedAdmin(req.user);
}

/**
 * دالة لتأمين وحصر نطاقات استعلام البيانات بناءً على هوية ودور المشرف.
 */
function getModelScope(req, modelName) {
  return adminService.getModelScope(req.user, modelName);
}

// 1. Admin Endpoint: Create University
router.post('/admin/universities', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { name, slug, themeColor, logoUrl } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ success: false, error: 'Name and slug are required' });
    }
    const university = await prisma.university.create({
      data: { name, slug, themeColor, logoUrl }
    });
    res.status(201).json({ success: true, data: university });
  } catch (error) {
    console.error('[API] Create university error:', error);
    res.status(500).json({ success: false, error: 'Failed to create university' });
  }
});

// 2. Admin Endpoint: Create College
router.post('/admin/colleges', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { name, slug, location, universityId } = req.body;
    if (!name || !slug || !universityId) {
      return res.status(400).json({ success: false, error: 'Name, slug, and universityId are required' });
    }
    const college = await prisma.college.create({
      data: { name, slug, location, universityId: parseInt(universityId) }
    });
    res.status(201).json({ success: true, data: college });
  } catch (error) {
    console.error('[API] Create college error:', error);
    res.status(500).json({ success: false, error: 'Failed to create college' });
  }
});

// 2b. Admin Endpoint: Manage Sub-Admins (Protected: SUPER_ADMIN only)
router.post('/admin/sub-admins', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { name, email, password, role, universityId, collegeId } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: 'Name, email, password, and role are required' });
    }
    if (role !== 'UNI_ADMIN' && role !== 'COLLEGE_ADMIN') {
      return res.status(400).json({ success: false, error: 'Role must be UNI_ADMIN or COLLEGE_ADMIN' });
    }
    if (role === 'UNI_ADMIN' && !universityId) {
      return res.status(400).json({ success: false, error: 'University selection is required for University Admin' });
    }
    if (role === 'COLLEGE_ADMIN' && !collegeId) {
      return res.status(400).json({ success: false, error: 'College selection is required for College Admin' });
    }

    const emailClash = await prisma.admin.findUnique({ where: { email } });
    if (emailClash) {
      return res.status(400).json({ success: false, error: 'Email address is already in use by another admin.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const subAdmin = await prisma.admin.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        universityId: universityId ? parseInt(universityId) : null,
        collegeId: collegeId ? parseInt(collegeId) : null
      }
    });

    const { password: _, ...safeAdmin } = subAdmin;
    res.status(201).json({ success: true, data: safeAdmin });
  } catch (error) {
    console.error('[API] Create sub-admin error:', error);
    res.status(500).json({ success: false, error: 'Failed to create sub-admin' });
  }
});

router.get('/admin/sub-admins', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const subAdmins = await prisma.admin.findMany({
      where: {
        role: { in: ['UNI_ADMIN', 'COLLEGE_ADMIN'] }
      },
      include: {
        university: true,
        college: true
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: subAdmins });
  } catch (error) {
    console.error('[API] Fetch sub-admins error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sub-admins' });
  }
});

router.delete('/admin/sub-admins/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const adminId = parseInt(req.params.id);
    await prisma.admin.delete({
      where: { id: adminId }
    });
    res.status(200).json({ success: true, message: 'Sub-admin deleted successfully' });
  } catch (error) {
    console.error('[API] Delete sub-admin error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete sub-admin' });
  }
});

// 3. God Mode - Get Metrics (Protected: SUPER_ADMIN only)
router.get('/admin/god-mode/metrics', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Access denied. Administrator role required.' });
    }

    const studentScope = getModelScope(req, 'Student');
    const totalStudents = await prisma.student.count({ where: studentScope });

    // Group by major (scoped to college/uni)
    const majorScope = {};
    if (req.user.role === 'COLLEGE_ADMIN') {
      majorScope.department = { collegeId: req.user.collegeId };
    } else if (req.user.role === 'UNI_ADMIN') {
      majorScope.department = { college: { universityId: req.user.universityId } };
    }

    const majorsData = await prisma.major.findMany({
      where: majorScope,
      include: {
        students: {
          where: studentScope
        }
      }
    });

    const studentsByMajor = majorsData.map(m => ({
      name: m.name,
      count: m.students.length
    }));

    // Group by level (scoped to college/uni students only — prevents cross-tenant data leakage)
    // We only return levels that have at least one student in this admin's scope.
    const levelsData = await prisma.level.findMany({
      where: {
        students: {
          some: studentScope  // ensures levels with zero in-scope students are excluded
        }
      },
      include: {
        students: {
          where: studentScope
        }
      }
    });

    const studentsByLevel = levelsData.map(l => ({
      name: l.name,
      count: l.students.length
    }));

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        studentsByMajor,
        studentsByLevel
      }
    });
  } catch (error) {
    console.error('[API] God Mode metrics error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve system metrics' });
  }
});

// 4. God Mode - Get All Students with details (Protected: SUPER_ADMIN only)
router.get('/admin/god-mode/students', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Access denied. Super Admin role required.' });
    }

    const students = await prisma.student.findMany({
      include: {
        major: true,
        group: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({ success: true, data: students });
  } catch (error) {
    console.error('[API] God Mode students fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve students list' });
  }
});

// 5. God Mode - Toggle Representative Status
router.put('/admin/god-mode/students/:id/representative', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }
    const studentId = parseInt(req.params.id);
    const { isRepresentative } = req.body;

    // Verify student belongs to administrator's college/uni scope
    const adminScope = getModelScope(req, 'Student');
    const student = await prisma.student.findFirst({
      where: { id: studentId, ...adminScope }
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found or unauthorized' });
    }

    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { isRepresentative }
    });

    res.status(200).json({ success: true, data: updatedStudent });
  } catch (error) {
    console.error('[API] Error toggling representative status:', error);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// 5b. Toggle Representative Status (Public Admin API with Isolation Scoping)
router.put('/admin/students/:id/representative-status', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const studentId = parseInt(req.params.id);
    const { isRepresentative } = req.body;
    const adminScope = getModelScope(req, 'Student');
    
    const student = await prisma.student.findFirst({
      where: { id: studentId, ...adminScope }
    });
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found or unauthorized' });
    }

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: { isRepresentative: !!isRepresentative }
    });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('[API] Error toggling representative status:', error);
    res.status(500).json({ success: false, error: 'Failed to update representative status' });
  }
});

// 6. God Mode - Delete Student (Protected: SUPER_ADMIN only)
router.delete('/admin/god-mode/students/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Access denied. Super Admin role required.' });
    }

    const studentId = parseInt(req.params.id);
    if (isNaN(studentId)) {
      return res.status(400).json({ success: false, error: 'Invalid Student ID' });
    }

    await prisma.student.delete({
      where: { id: studentId }
    });

    res.status(200).json({ success: true, message: 'Student successfully purged.' });
  } catch (error) {
    console.error('[API] God Mode delete student error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete student' });
  }
});

// 6b. God Mode - Get All Users (Students, Lecturers, Sub-Admins) (Protected: SUPER_ADMIN only)
router.get('/admin/god-mode/users', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Access denied. Super Admin role required.' });
    }

    const [students, lecturers, admins] = await Promise.all([
      prisma.student.findMany({
        include: { major: true, group: true, college: true },
        orderBy: { name: 'asc' }
      }),
      prisma.lecturer.findMany({
        include: { college: true },
        orderBy: { name: 'asc' }
      }),
      prisma.admin.findMany({
        where: { role: { in: ['UNI_ADMIN', 'COLLEGE_ADMIN'] } },
        include: { university: true, college: true },
        orderBy: { name: 'asc' }
      })
    ]);

    res.status(200).json({
      success: true,
      data: { students, lecturers, admins }
    });
  } catch (error) {
    console.error('[API] God Mode users fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve users directory' });
  }
});

// 6c. God Mode - Delete Lecturer (Protected: SUPER_ADMIN only)
router.delete('/admin/god-mode/lecturers/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Access denied. Super Admin role required.' });
    }

    const lecturerId = parseInt(req.params.id);
    if (isNaN(lecturerId)) {
      return res.status(400).json({ success: false, error: 'Invalid Lecturer ID' });
    }

    await prisma.lecturer.delete({
      where: { id: lecturerId }
    });

    res.status(200).json({ success: true, message: 'Lecturer successfully purged.' });
  } catch (error) {
    console.error('[API] God Mode delete lecturer error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete lecturer: ' + error.message });
  }
});

// 6d. Manage Lecturers - Create (Protected: Admin)
router.post('/admin/lecturers', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { name, email, password, phone, collegeId } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }

    let targetCollegeId = collegeId ? parseInt(collegeId) : undefined;
    if (req.user.role !== 'SUPER_ADMIN') {
      targetCollegeId = req.user.collegeId;
    }
    
    if (!targetCollegeId) {
      return res.status(400).json({ success: false, error: 'College ID is required' });
    }

    const emailClash = await prisma.lecturer.findUnique({ where: { email } });
    if (emailClash) {
      return res.status(400).json({ success: false, error: 'Email address is already in use by another lecturer.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const lecturer = await prisma.lecturer.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        collegeId: targetCollegeId
      }
    });

    const { password: _, ...safeLecturer } = lecturer;
    res.status(201).json({ success: true, data: safeLecturer });
  } catch (error) {
    console.error('[API] Create lecturer error:', error);
    res.status(500).json({ success: false, error: 'Failed to create lecturer' });
  }
});

// 6e. Manage Lecturers - Get All (Protected: Admin)
router.get('/admin/lecturers', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    
    let whereClause = {};
    if (req.user.role === 'COLLEGE_ADMIN') {
      whereClause.collegeId = req.user.collegeId;
    } else if (req.user.role === 'UNI_ADMIN') {
      whereClause.college = { universityId: req.user.universityId };
    }

    const lecturers = await prisma.lecturer.findMany({
      where: whereClause,
      include: {
        college: true,
        schedules: {
          include: { subject: true, group: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Remove passwords
    const safeLecturers = lecturers.map(l => {
      const { password, ...safe } = l;
      return safe;
    });

    res.status(200).json({ success: true, data: safeLecturers });
  } catch (error) {
    console.error('[API] Fetch lecturers error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch lecturers' });
  }
});

// 6f. Manage Lecturers - Update (Protected: Admin)
router.put('/admin/lecturers/:id', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    
    const lecturerId = parseInt(req.params.id);
    const { name, email, password, phone } = req.body;

    const lecturer = await prisma.lecturer.findUnique({ where: { id: lecturerId }, include: { college: true } });
    if (!lecturer) {
      return res.status(404).json({ success: false, error: 'Lecturer not found' });
    }

    // Check scope
    if (req.user.role === 'COLLEGE_ADMIN' && lecturer.collegeId !== req.user.collegeId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    if (req.user.role === 'UNI_ADMIN' && lecturer.college.universityId !== req.user.universityId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    let updateData = { name, email, phone };
    
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updated = await prisma.lecturer.update({
      where: { id: lecturerId },
      data: updateData
    });

    const { password: _, ...safeLecturer } = updated;
    res.status(200).json({ success: true, data: safeLecturer });
  } catch (error) {
    console.error('[API] Update lecturer error:', error);
    res.status(500).json({ success: false, error: 'Failed to update lecturer' });
  }
});

// 7. GET all unverified students (Protected: Admins/Super Admins only)
router.get('/admin/unverified-students', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { collegeId } = req.query;
    const adminScope = getModelScope(req, 'Student');
    const whereClause = {
      ...adminScope
    };
    if (req.user.role === 'SUPER_ADMIN' && collegeId) {
      whereClause.collegeId = parseInt(collegeId);
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        major: { include: { department: true } },
        level: true,
        group: true
      },
      orderBy: { createdAt: 'desc' }, // newest registrants first
      take: 100 // limit to 100 recent registrations
    });
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    console.error('[API] Error fetching unverified students:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unverified students' });
  }
});

// 8. POST approve student (Protected: Admins/Super Admins only)
router.post('/admin/students/:id/approve', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const studentId = parseInt(req.params.id);
    
    // Verify student belongs to administrator's college if not super admin
    const adminScope = getModelScope(req, 'Student');
    const student = await prisma.student.findFirst({
      where: { id: studentId, ...adminScope }
    });
    if (!student) {
      return res.status(403).json({ success: false, error: 'Forbidden or not found' });
    }

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        isEmailVerified: true,
        isPhoneVerified: true
      }
    });

    res.status(200).json({ success: true, message: 'Student successfully approved.', data: updated });
  } catch (error) {
    console.error('[API] Error approving student:', error);
    res.status(500).json({ success: false, error: 'Failed to approve student' });
  }
});

// 9. POST reject student (Protected: Admins/Super Admins only)
router.post('/admin/students/:id/reject', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const studentId = parseInt(req.params.id);

    // Verify student belongs to administrator's college if not super admin
    const adminScope = getModelScope(req, 'Student');
    const student = await prisma.student.findFirst({
      where: { id: studentId, ...adminScope }
    });
    if (!student) {
      return res.status(403).json({ success: false, error: 'Forbidden or not found' });
    }

    await prisma.student.delete({
      where: { id: studentId }
    });

    res.status(200).json({ success: true, message: 'Student successfully rejected and deleted.' });
  } catch (error) {
    console.error('[API] Error rejecting student:', error);
    res.status(500).json({ success: false, error: 'Failed to reject student' });
  }
});

// 10. GET all students (Protected: Admins/Super Admins only)
router.get('/students', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { collegeId, page, limit, searchQuery, majorId, levelId, groupId, showUnverifiedOnly } = req.query;
    let whereClause = getModelScope(req, 'Student');
    if (req.user.role === 'SUPER_ADMIN' && collegeId) {
      whereClause = { ...whereClause, collegeId: parseInt(collegeId) };
    }

    if (searchQuery) {
      whereClause.OR = [
        { name: { contains: searchQuery, mode: 'insensitive' } },
        { email: { contains: searchQuery, mode: 'insensitive' } },
        { idNumber: { contains: searchQuery, mode: 'insensitive' } }
      ];
    }
    if (majorId && majorId !== 'ALL') {
      whereClause.majorId = parseInt(majorId);
    }
    if (levelId && levelId !== 'ALL') {
      whereClause.levelId = parseInt(levelId);
    }
    if (groupId && groupId !== 'ALL') {
      whereClause.groupId = parseInt(groupId);
    }
    if (showUnverifiedOnly === 'true') {
      whereClause.OR = [
        { isEmailVerified: false },
        { isPhoneVerified: false }
      ];
    }

    if (page && limit) {
      const p = parseInt(page) || 1;
      const l = parseInt(limit) || 15;
      const skip = (p - 1) * l;

      const [students, totalCount] = await Promise.all([
        prisma.student.findMany({
          where: whereClause,
          include: {
            major: { include: { department: true } },
            level: true,
            group: true
          },
          orderBy: { name: 'asc' },
          skip,
          take: l
        }),
        prisma.student.count({ where: whereClause })
      ]);

      return res.status(200).json({
        success: true,
        data: students,
        totalCount,
        hasMore: skip + students.length < totalCount
      });
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        major: { include: { department: true } },
        level: true,
        group: true
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    console.error('[API] Error fetching students:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch students' });
  }
});

// 11. POST OVERRIDE (Protected: Drag & Drop Exception Handler + Notification Trigger)
/**
 * مسار إنشاء استثناء وتعديل طارئ في موعد أو قاعة المحاضرة ( Drag & Drop).
 * 
 * البيانات الواردة (Payload):
 * - scheduleId: معرف الحصة الدراسية المراد تعديلها (number).
 * - newStartTime: وقت البدء البديل (string).
 * - newEndTime: وقت الانتهاء البديل (string).
 * - newRoomId: معرف القاعة البديلة (number).
 * - date: تاريخ حدوث الاستثناء المخطط (string).
 * - overrideType: نوع الاستثناء ('TEMPORARY' أو 'PERMANENT').
 * البيانات الصادرة (Response):
 * - success: true
 * - message: رسالة تأكيد الحفظ بنجاح.
 * - data: كائن الاستثناء المولد بقاعدة البيانات.
 */
router.post('/schedules/override', verifyToken, async (req, res) => {
  try {
    // التحقق من الصلاحيات الإدارية للمستخدم
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Only administrators can modify schedules' });
    }

    const { scheduleId, newStartTime, newEndTime, newRoomId, date, overrideType } = req.body;

    const userScope = getModelScope(req, 'Schedule');
    const override = await scheduleService.createOverride(
      scheduleId,
      newStartTime,
      newEndTime,
      newRoomId,
      date,
      overrideType,
      userScope
    );

    res.status(201).json({
      success: true,
      message: 'Schedule overridden and targeted notification queued successfully.',
      data: override
    });

  } catch (error) {
    console.error('[API] Error creating override:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to create override' });
  }
});

// 12. POST NEW BASE SCHEDULE (Protected: Manual Schedule Entry)
router.post('/schedules', verifyToken, async (req, res) => {
  try {
    // Role Authorization Check
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Only administrators can add schedules' });
    }

    const {
      subjectName,
      subjectCode,
      subjectType,
      roomName,
      roomCapacity,
      lecturerName,
      groupName,
      dayOfWeek,
      startTime,
      endTime,
      collegeId,
      lecturerId: bodyLecturerId
    } = req.body;

    if (!subjectName || !subjectCode || !subjectType || !roomName || !lecturerName || !groupName || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'Missing required schedule fields' });
    }

    let targetCollegeId = collegeId ? parseInt(collegeId) : undefined;
    if (req.user.role !== 'SUPER_ADMIN') {
      const adminScope = getModelScope(req, 'College');
      const allowedCollege = await prisma.college.findFirst({
        where: {
          id: targetCollegeId || req.user.collegeId,
          ...adminScope
        }
      });
      if (!allowedCollege) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      targetCollegeId = allowedCollege.id;
    } else {
      if (!targetCollegeId) {
        return res.status(400).json({ success: false, error: 'College ID is required for schedule creation' });
      }
    }

    const upperSubjectType = subjectType.toUpperCase();
    if (upperSubjectType !== 'THEORY' && upperSubjectType !== 'PRACTICAL') {
      return res.status(400).json({ success: false, error: 'Invalid subject type. Must be THEORY or PRACTICAL.' });
    }

    const upperDayOfWeek = dayOfWeek.toUpperCase();
    const validDays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    if (!validDays.includes(upperDayOfWeek)) {
      return res.status(400).json({ success: false, error: 'Invalid day of week. Must be one of: ' + validDays.join(', ') });
    }

    // A. Find or create Subject
    const existingSubject = await prisma.subject.findUnique({ where: { code: subjectCode } });
    if (existingSubject && existingSubject.collegeId !== targetCollegeId) {
      return res.status(409).json({ success: false, error: 'رمز المادة مستخدم بالفعل في كلية أخرى' });
    }
    const subject = await prisma.subject.upsert({
      where: { code: subjectCode },
      update: { name: subjectName, type: upperSubjectType, collegeId: targetCollegeId },
      create: { name: subjectName, code: subjectCode, type: upperSubjectType, collegeId: targetCollegeId }
    });

    // B. Find or create Room
    const existingRoom = await prisma.room.findUnique({ where: { name: roomName } });
    if (existingRoom && existingRoom.collegeId !== targetCollegeId) {
      return res.status(409).json({ success: false, error: 'اسم القاعة مستخدم بالفعل في كلية أخرى' });
    }
    const room = await prisma.room.upsert({
      where: { name: roomName },
      update: { capacity: parseInt(roomCapacity) || 45, collegeId: targetCollegeId },
      create: { name: roomName, capacity: parseInt(roomCapacity) || 45, collegeId: targetCollegeId }
    });

    // C. Find or create Group
    let group = await prisma.group.findFirst({
      where: { name: groupName, collegeId: targetCollegeId }
    });
    if (!group) {
      group = await prisma.group.create({
        data: { name: groupName, collegeId: targetCollegeId }
      });
    }

    // C.5 Find Lecturer by Name
    // C.5 Find Lecturer by Name or use bodyLecturerId
    let lecturerId = bodyLecturerId ? parseInt(bodyLecturerId) : null;
    if (!lecturerId) {
      const lecturer = await prisma.lecturer.findFirst({
        where: { name: lecturerName, collegeId: targetCollegeId }
      });
      if (lecturer) {
        lecturerId = lecturer.id;
      }
    }

    // D. Check for schedule conflicts
    const clash = await prisma.schedule.findFirst({
      where: {
        dayOfWeek: upperDayOfWeek,
        startTime,
        collegeId: targetCollegeId,
        subjectId: { not: subject.id }, // Bypass shared class of same subject
        OR: [{ roomId: room.id }, lecturerId ? { lecturerId } : { lecturerName }]
      }
    });
    if (clash) {
      return res.status(409).json({ success: false, error: 'Conflict: Room or Lecturer already assigned to another class during this time slot.' });
    }

    // E. Save the new base schedule
    const newSchedule = await prisma.schedule.create({
      data: {
        subjectId: subject.id,
        roomId: room.id,
        groupId: group.id,
        lecturerName,
        lecturerId,
        dayOfWeek: upperDayOfWeek,
        startTime,
        endTime,
        collegeId: targetCollegeId
      },
      include: {
        subject: true,
        room: true,
        group: true,
        overrides: true
      }
    });

    // Trigger live SSE broadcast
    broadcastSSE('SCHEDULE_UPDATE', { scheduleId: newSchedule.id });

    // Trigger push notification
    sendPushNotification(newSchedule.groupId, {
      title: 'محاضرة جديدة مضافة',
      body: `تمت إضافة محاضرة جديدة: ${newSchedule.subject.name} في قاعة ${newSchedule.room.name}`,
      url: '/student/home'
    });

    res.status(201).json({
      success: true,
      message: 'Base schedule created successfully.',
      data: newSchedule
    });

  } catch (error) {
    console.error('[API] Error creating base schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to create base schedule' });
  }
});

// 12.5 PUT UPDATE SCHEDULE (Protected: Admin Edit)
router.put('/schedules/:id', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Only administrators can edit schedules' });
    }

    const scheduleId = parseInt(req.params.id);
    if (isNaN(scheduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid Schedule ID' });
    }

    const {
      subjectName,
      subjectCode,
      subjectType,
      roomName,
      roomCapacity,
      lecturerName,
      groupName,
      dayOfWeek,
      startTime,
      endTime,
      collegeId,
      lecturerId: bodyLecturerId
    } = req.body;

    if (!subjectName || !subjectCode || !subjectType || !roomName || !lecturerName || !groupName || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'Missing required schedule fields' });
    }

    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        ...getModelScope(req, 'Schedule')
      }
    });

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found or unauthorized' });
    }

    const targetCollegeId = schedule.collegeId;

    const upperSubjectType = subjectType.toUpperCase();
    if (upperSubjectType !== 'THEORY' && upperSubjectType !== 'PRACTICAL') {
      return res.status(400).json({ success: false, error: 'Invalid subject type. Must be THEORY or PRACTICAL.' });
    }

    const upperDayOfWeek = dayOfWeek.toUpperCase();
    const validDays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    if (!validDays.includes(upperDayOfWeek)) {
      return res.status(400).json({ success: false, error: 'Invalid day of week. Must be one of: ' + validDays.join(', ') });
    }

    // A. Find or create Subject
    const existingSubject = await prisma.subject.findUnique({ where: { code: subjectCode } });
    if (existingSubject && existingSubject.collegeId !== targetCollegeId) {
      return res.status(409).json({ success: false, error: 'رمز المادة مستخدم بالفعل في كلية أخرى' });
    }
    const subject = await prisma.subject.upsert({
      where: { code: subjectCode },
      update: { name: subjectName, type: upperSubjectType, collegeId: targetCollegeId },
      create: { name: subjectName, code: subjectCode, type: upperSubjectType, collegeId: targetCollegeId }
    });

    // B. Find or create Room
    const existingRoom = await prisma.room.findUnique({ where: { name: roomName } });
    if (existingRoom && existingRoom.collegeId !== targetCollegeId) {
      return res.status(409).json({ success: false, error: 'اسم القاعة مستخدم بالفعل في كلية أخرى' });
    }
    const room = await prisma.room.upsert({
      where: { name: roomName },
      update: { capacity: parseInt(roomCapacity) || 45, collegeId: targetCollegeId },
      create: { name: roomName, capacity: parseInt(roomCapacity) || 45, collegeId: targetCollegeId }
    });

    // C. Find or create Group
    let group = await prisma.group.findFirst({
      where: { name: groupName, collegeId: targetCollegeId }
    });
    if (!group) {
      group = await prisma.group.create({
        data: { name: groupName, collegeId: targetCollegeId }
      });
    }

    // C.5 Find Lecturer by Name
    // C.5 Find Lecturer by Name or use bodyLecturerId
    let lecturerId = bodyLecturerId ? parseInt(bodyLecturerId) : null;
    if (!lecturerId) {
      const lecturer = await prisma.lecturer.findFirst({
        where: { name: lecturerName, collegeId: targetCollegeId }
      });
      if (lecturer) {
        lecturerId = lecturer.id;
      }
    }

    // D. Check for schedule conflicts (exclude current scheduleId!)
    const clash = await prisma.schedule.findFirst({
      where: {
        id: { not: scheduleId },
        dayOfWeek: upperDayOfWeek,
        startTime,
        collegeId: targetCollegeId,
        subjectId: { not: subject.id }, // Bypass shared class of same subject
        OR: [{ roomId: room.id }, lecturerId ? { lecturerId } : { lecturerName }]
      }
    });
    if (clash) {
      return res.status(409).json({ success: false, error: 'Conflict: Room or Lecturer already assigned to another class during this time slot.' });
    }

    // E. Update schedule
    const updatedSchedule = await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        subjectId: subject.id,
        roomId: room.id,
        groupId: group.id,
        lecturerName,
        lecturerId,
        dayOfWeek: upperDayOfWeek,
        startTime,
        endTime
      },
      include: {
        subject: true,
        room: true,
        group: true
      }
    });

    // Trigger live SSE broadcast
    broadcastSSE('SCHEDULE_UPDATE', { scheduleId: updatedSchedule.id });

    // Trigger push notification
    sendPushNotification(updatedSchedule.groupId, {
      title: 'تم تعديل محاضرة',
      body: `تم تعديل محاضرة: ${updatedSchedule.subject.name} لتصبح في قاعة ${updatedSchedule.room.name}`,
      url: '/student/home'
    });

    res.status(200).json({
      success: true,
      message: 'Schedule updated successfully.',
      data: updatedSchedule
    });

  } catch (error) {
    console.error('[API] Error updating schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to update schedule' });
  }
});

// 12.6 DELETE SCHEDULE (Protected: Admin Delete)
router.delete('/schedules/:id', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Only administrators can delete schedules' });
    }

    const scheduleId = parseInt(req.params.id);
    if (isNaN(scheduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid Schedule ID' });
    }

    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        ...getModelScope(req, 'Schedule')
      }
    });

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found or unauthorized' });
    }

    // Delete associated overrides & reschedule requests first to prevent foreign key constraint fails
    await prisma.scheduleOverride.deleteMany({ where: { scheduleId } });
    await prisma.rescheduleRequest.deleteMany({ where: { scheduleId } });

    // Delete the schedule (cascades to AttendanceRecord and Attendance)
    await prisma.schedule.delete({
      where: { id: scheduleId }
    });

    // Trigger live SSE broadcast
    broadcastSSE('SCHEDULE_UPDATE', { scheduleId });

    res.status(200).json({
      success: true,
      message: 'Schedule deleted successfully.'
    });

  } catch (error) {
    console.error('[API] Error deleting schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to delete schedule' });
  }
});

// 13. POST Group
router.post('/groups', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id, name, collegeId } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Group name is required' });
    }

    let targetCollegeId = collegeId ? parseInt(collegeId) : undefined;
    if (req.user.role !== 'SUPER_ADMIN') {
      const adminScope = getModelScope(req, 'College');
      const allowedCollege = await prisma.college.findFirst({
        where: { id: targetCollegeId || req.user.collegeId, ...adminScope }
      });
      if (!allowedCollege) return res.status(403).json({ success: false, error: 'Forbidden' });
      targetCollegeId = allowedCollege.id;
    } else {
      if (!targetCollegeId) {
        return res.status(400).json({ success: false, error: 'College ID is required' });
      }
    }

    let group;
    if (id) {
      const adminScope = getModelScope(req, 'Group');
      const existing = await prisma.group.findFirst({
        where: { id: parseInt(id), ...adminScope }
      });
      if (!existing) return res.status(403).json({ success: false, error: 'Forbidden' });

      const nameClash = await prisma.group.findFirst({
        where: { name, collegeId: targetCollegeId, id: { not: parseInt(id) } }
      });
      if (nameClash) {
        return res.status(400).json({ success: false, error: 'اسم الشعبة مستخدم بالفعل في هذه الكلية' });
      }

      group = await prisma.group.update({
        where: { id: parseInt(id) },
        data: { name }
      });
    } else {
      const nameClash = await prisma.group.findFirst({
        where: { name, collegeId: targetCollegeId }
      });
      if (nameClash) {
        return res.status(400).json({ success: false, error: 'اسم الشعبة مستخدم بالفعل في هذه الكلية' });
      }

      group = await prisma.group.create({
        data: { name, collegeId: targetCollegeId }
      });
    }
    res.status(201).json({ success: true, data: group });
  } catch (error) {
    console.error('[API] Error saving group:', error);
    res.status(500).json({ success: false, error: 'Failed to save group' });
  }
});

// 14. DELETE Group
router.delete('/groups/:id', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id } = req.params;

    const adminScope = getModelScope(req, 'Group');
    const existing = await prisma.group.findFirst({
      where: { id: parseInt(id), ...adminScope }
    });
    if (!existing) return res.status(403).json({ success: false, error: 'Forbidden or not found' });

    const scheduleCount = await prisma.schedule.count({
      where: { groupId: parseInt(id) }
    });
    const studentCount = await prisma.student.count({
      where: { groupId: parseInt(id) }
    });
    const logCount = await prisma.notificationLog.count({
      where: { groupId: parseInt(id) }
    });

    if (scheduleCount > 0 || studentCount > 0 || logCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete group: It is currently assigned to schedules, students, or notification logs.'
      });
    }

    await prisma.group.delete({
      where: { id: parseInt(id) }
    });
    res.status(200).json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    console.error('[API] Error deleting group:', error);
    res.status(500).json({ success: false, error: 'Failed to delete group' });
  }
});

// 15. POST Room
router.post('/rooms', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id, name, capacity, collegeId } = req.body;
    if (!name || !capacity) {
      return res.status(400).json({ success: false, error: 'Room name and capacity are required' });
    }

    let targetCollegeId = collegeId ? parseInt(collegeId) : undefined;
    if (req.user.role !== 'SUPER_ADMIN') {
      const adminScope = getModelScope(req, 'College');
      const allowedCollege = await prisma.college.findFirst({
        where: { id: targetCollegeId || req.user.collegeId, ...adminScope }
      });
      if (!allowedCollege) return res.status(403).json({ success: false, error: 'Forbidden' });
      targetCollegeId = allowedCollege.id;
    } else {
      if (!targetCollegeId) {
        return res.status(400).json({ success: false, error: 'College ID is required' });
      }
    }

    let room;
    if (id) {
      const adminScope = getModelScope(req, 'Room');
      const existing = await prisma.room.findFirst({
        where: { id: parseInt(id), ...adminScope }
      });
      if (!existing) return res.status(403).json({ success: false, error: 'Forbidden' });

      const nameClash = await prisma.room.findFirst({
        where: { name, id: { not: parseInt(id) } }
      });
      if (nameClash) {
        if (nameClash.collegeId !== targetCollegeId) {
          return res.status(409).json({ success: false, error: 'اسم القاعة مستخدم بالفعل في كلية أخرى' });
        }
        return res.status(409).json({ success: false, error: 'اسم القاعة مستخدم بالفعل في هذه الكلية' });
      }

      room = await prisma.room.update({
        where: { id: parseInt(id) },
        data: { name, capacity: parseInt(capacity) }
      });
    } else {
      const nameClash = await prisma.room.findUnique({ where: { name } });
      if (nameClash) {
        if (nameClash.collegeId !== targetCollegeId) {
          return res.status(409).json({ success: false, error: 'اسم القاعة مستخدم بالفعل في كلية أخرى' });
        }
        return res.status(409).json({ success: false, error: 'اسم القاعة مستخدم بالفعل في هذه الكلية' });
      }

      room = await prisma.room.create({
        data: { name, capacity: parseInt(capacity), collegeId: targetCollegeId }
      });
    }
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    console.error('[API] Error saving room:', error);
    res.status(500).json({ success: false, error: 'Failed to save room' });
  }
});

// 16. DELETE Room
router.delete('/rooms/:id', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id } = req.params;

    const adminScope = getModelScope(req, 'Room');
    const existing = await prisma.room.findFirst({
      where: { id: parseInt(id), ...adminScope }
    });
    if (!existing) return res.status(403).json({ success: false, error: 'Forbidden' });

    const scheduleCount = await prisma.schedule.count({
      where: { roomId: parseInt(id) }
    });
    const overrideCount = await prisma.scheduleOverride.count({
      where: { newRoomId: parseInt(id) }
    });

    if (scheduleCount > 0 || overrideCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete room: It is currently assigned to active schedules or overrides.'
      });
    }

    await prisma.room.delete({
      where: { id: parseInt(id) }
    });
    res.status(200).json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    console.error('[API] Error deleting room:', error);
    res.status(500).json({ success: false, error: 'Failed to delete room' });
  }
});

// 17. GET Admin Metrics
router.get('/admin/metrics', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    
    const { collegeId } = req.query;
    let studentScope = getModelScope(req, 'Student');
    let scheduleScope = getModelScope(req, 'Schedule');
    let deptScope = getModelScope(req, 'Department');
    let roomScope = getModelScope(req, 'Room');

    if (req.user.role === 'SUPER_ADMIN' && collegeId) {
      const parsedCollegeId = parseInt(collegeId);
      studentScope = { collegeId: parsedCollegeId };
      scheduleScope = { collegeId: parsedCollegeId };
      deptScope = { collegeId: parsedCollegeId };
      roomScope = { collegeId: parsedCollegeId };
    }

    const students = await prisma.student.count({ where: studentScope });
    const schedules = await prisma.schedule.count({ where: scheduleScope });
    const departments = await prisma.department.count({ where: deptScope });
    const rooms = await prisma.room.count({ where: roomScope });

    res.status(200).json({
      success: true,
      data: { students, lectures: schedules, departments, classrooms: rooms }
    });
  } catch (error) {
    console.error('[API] Error fetching metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch metrics' });
  }
});

// ── GET /api/admin/analytics ─────────────────────────────────────────────────
/**
 * مسار تجميع تحليلات النظام وحساب نسبة صحة حضور الكلية للثلاثين يوماً الماضية.
 * 
 * البيانات الواردة:
 * - collegeId: معرف الكلية المراد تصفيتها للمشرف العام (query string).
 * البيانات الصادرة (Response):
 * - success: true
 * - data: كائن يحتوي على نسب صحة الحضور، الغيابات، أعداد الشُعب والطلاب وتفاصيل أكبر شعب الكلية.
 */
router.get('/admin/analytics', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const analyticsData = await adminService.getAnalytics(req.query.collegeId, req.user);

    res.status(200).json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    console.error('[API] Error fetching analytics:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch analytics' });
  }
});


router.post('/broadcasts', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { groupId, message, collegeId } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const parsedGroupId = groupId === 'ALL' || !groupId ? null : parseInt(groupId);
    
    let targetCollegeId = collegeId ? parseInt(collegeId) : null;
    if (req.user.role !== 'SUPER_ADMIN') {
      targetCollegeId = req.user.collegeId;
    }

    if (parsedGroupId) {
      // Verify group belongs to admin's scope
      const adminScope = getModelScope(req, 'Group');
      const allowedGroup = await prisma.group.findFirst({
        where: { id: parsedGroupId, ...adminScope }
      });
      if (!allowedGroup) {
        return res.status(403).json({ success: false, error: 'Forbidden: Group does not belong to your scope' });
      }

      const log = await prisma.notificationLog.create({
        data: {
          groupId: parsedGroupId,
          message,
          status: 'PENDING'
        }
      });

      // Trigger live SSE broadcast
      broadcastSSE('BROADCAST_MESSAGE', { groupId: parsedGroupId, message });

      // Trigger push notification
      sendPushNotification(parsedGroupId, {
        title: 'تنبيه جديد من الكلية',
        body: message,
        url: '/student/home'
      });

      res.status(201).json({ success: true, data: log });
    } else {
      // Global broadcast for college
      const collegeGroups = await getCollegeGroupsForBroadcast(req, targetCollegeId);

      if (collegeGroups.length === 0) {
        return res.status(400).json({ success: false, error: 'No groups found for this college to broadcast to' });
      }

      const logs = [];
      for (const grp of collegeGroups) {
        const log = await prisma.notificationLog.create({
          data: {
            groupId: grp.id,
            message,
            status: 'PENDING'
          }
        });
        logs.push(log);

        // Trigger live SSE broadcast
        broadcastSSE('BROADCAST_MESSAGE', { groupId: grp.id, message });

        // Trigger push notification
        sendPushNotification(grp.id, {
          title: 'تنبيه جديد من الكلية',
          body: message,
          url: '/student/home'
        });
      }

      res.status(201).json({ success: true, data: logs[0] });
    }
  } catch (error) {
    console.error('[API] Error creating broadcast:', error);
    res.status(500).json({ success: false, error: 'Failed to create broadcast' });
  }
});

// 18b. POST Global Broadcast for sub-admin colleges (Helper)
async function getCollegeGroupsForBroadcast(req, targetCollegeId) {
  if (req.user.role === 'SUPER_ADMIN') {
    if (!targetCollegeId) return [];
    return prisma.group.findMany({ where: { collegeId: targetCollegeId } });
  }
  
  if (req.user.role === 'UNI_ADMIN') {
    return prisma.group.findMany({
      where: {
        college: {
          id: targetCollegeId ? parseInt(targetCollegeId) : undefined,
          universityId: parseInt(req.user.universityId)
        }
      }
    });
  }
  
  if (req.user.role === 'COLLEGE_ADMIN') {
    return prisma.group.findMany({
      where: { collegeId: parseInt(req.user.collegeId) }
    });
  }
  return [];
}

// 19. GET Admin Logs
router.get('/admin/logs', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    
    const { collegeId } = req.query;
    const filter = {};
    
    if (req.user.role === 'SUPER_ADMIN') {
      if (collegeId) {
        filter.OR = [
          { group: { collegeId: parseInt(collegeId) } },
          { student: { collegeId: parseInt(collegeId) } }
        ];
      }
    } else if (req.user.role === 'UNI_ADMIN') {
      const targetCollegeId = collegeId ? parseInt(collegeId) : undefined;
      filter.OR = [
        {
          group: {
            college: {
              id: targetCollegeId,
              universityId: parseInt(req.user.universityId)
            }
          }
        },
        {
          student: {
            college: {
              id: targetCollegeId,
              universityId: parseInt(req.user.universityId)
            }
          }
        }
      ];
    } else if (req.user.role === 'COLLEGE_ADMIN') {
      filter.OR = [
        { group: { collegeId: parseInt(req.user.collegeId) } },
        { student: { collegeId: parseInt(req.user.collegeId) } }
      ];
    }

    const logs = await prisma.notificationLog.findMany({
      where: filter,
      include: {
        group: true
      },
      orderBy: {
        sentTime: 'desc'
      }
    });
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error('[API] Error fetching logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
});

// 20. DELETE Admin Logs
router.delete('/admin/logs', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const adminScope = getModelScope(req, 'Group'); // scoping logs delete to college/uni
    if (req.user.role === 'COLLEGE_ADMIN') {
      await prisma.notificationLog.deleteMany({
        where: {
          OR: [
            { group: { collegeId: req.user.collegeId } },
            { student: { collegeId: req.user.collegeId } }
          ]
        }
      });
    } else if (req.user.role === 'UNI_ADMIN') {
      await prisma.notificationLog.deleteMany({
        where: {
          OR: [
            { group: { college: { universityId: req.user.universityId } } },
            { student: { college: { universityId: req.user.universityId } } }
          ]
        }
      });
    } else {
      await prisma.notificationLog.deleteMany({});
    }
    res.status(200).json({ success: true, message: 'All logs cleared successfully' });
  } catch (error) {
    console.error('[API] Error clearing logs:', error);
    res.status(500).json({ success: false, error: 'Failed to clear logs' });
  }
});

// 21. GET all rescheduling requests (Admin view)
router.get('/admin/requests', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }
    const { collegeId } = req.query;
    const whereClause = {};
    if (req.user.role === 'COLLEGE_ADMIN') {
      whereClause.schedule = { collegeId: req.user.collegeId };
    } else if (req.user.role === 'UNI_ADMIN') {
      whereClause.schedule = { college: { universityId: req.user.universityId } };
    } else if (req.user.role === 'SUPER_ADMIN' && collegeId) {
      whereClause.schedule = { collegeId: parseInt(collegeId) };
    }

    const requests = await prisma.rescheduleRequest.findMany({
      where: whereClause,
      include: {
        lecturer: true,
        schedule: {
          include: { subject: true, room: true, group: true }
        },
        newRoom: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('[API] Error fetching admin requests:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch requests' });
  }
});

// 22. POST resolve rescheduling request (Admin view)
router.post('/admin/requests/:id/resolve', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }
    const requestId = parseInt(req.params.id);
    const { status, overrideType, date, adminNotes } = req.body; // overrideType is 'TEMPORARY' or 'PERMANENT'

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid or missing status field' });
    }

    const request = await prisma.rescheduleRequest.findFirst({
      where: {
        id: requestId,
        ...(req.user.role === 'COLLEGE_ADMIN' ? { schedule: { collegeId: req.user.collegeId } } : {}),
        ...(req.user.role === 'UNI_ADMIN' ? { schedule: { college: { universityId: req.user.universityId } } } : {})
      },
      include: {
        schedule: { include: { subject: true, group: true, room: true } },
        lecturer: true
      }
    });

    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found or unauthorized' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Request is already resolved' });
    }

    if (status === 'APPROVED') {
      const isReschedule = request.requestType === 'RESCHEDULE';
      const resolvedOverrideType = overrideType || 'TEMPORARY'; // Fallback to TEMPORARY

      if (resolvedOverrideType === 'TEMPORARY') {
        const targetDate = date ? new Date(date) : new Date();
        // Create a ScheduleOverride entry
        await prisma.scheduleOverride.create({
          data: {
            scheduleId: request.scheduleId,
            newStartTime: isReschedule ? request.newStartTime : null,
            newEndTime: isReschedule ? request.newEndTime : null,
            newRoomId: isReschedule ? request.newRoomId : null,
            date: targetDate,
            overrideType: 'TEMPORARY'
          }
        });
      } else {
        // Permanent modification of base Schedule
        await prisma.schedule.update({
          where: { id: request.scheduleId },
          data: {
            dayOfWeek: isReschedule ? request.newDayOfWeek : request.schedule.dayOfWeek,
            startTime: isReschedule ? request.newStartTime : request.schedule.startTime,
            endTime: isReschedule ? request.newEndTime : request.schedule.endTime,
            roomId: isReschedule ? (request.newRoomId || request.schedule.roomId) : request.schedule.roomId
          }
        });
      }

      // Format notification message in Arabic
      let alertMessage = '';
      if (request.requestType === 'CANCEL') {
        alertMessage = `تنبيه: تم إلغاء محاضرة ${request.schedule.subject.name} المقررة يوم ${request.schedule.dayOfWeek} للشعبة ${request.schedule.group.name}.`;
      } else {
        const dayNamesAr = {
          SUNDAY: 'الأحد', MONDAY: 'الإثنين', TUESDAY: 'الثلاثاء',
          WEDNESDAY: 'الأربعاء', THURSDAY: 'الخميس', FRIDAY: 'الجمعة', SATURDAY: 'السبت'
        };
        const dayAr = dayNamesAr[request.newDayOfWeek] || request.newDayOfWeek;
        alertMessage = `تنبيه: تم إعادة جدولة محاضرة ${request.schedule.subject.name} للشعبة ${request.schedule.group.name} لتصبح يوم ${dayAr} من ${request.newStartTime} إلى ${request.newEndTime}.`;
      }

      // Log notification
      await prisma.notificationLog.create({
        data: {
          groupId: request.schedule.groupId,
          message: alertMessage,
          status: 'PENDING'
        }
      });

      // Broadcast update
      broadcastSSE('SCHEDULE_UPDATE', { scheduleId: request.scheduleId });

      // Send push notification
      sendPushNotification(request.schedule.groupId, {
        title: 'تحديث طارئ في الجدول',
        body: alertMessage,
        url: '/student/home'
      });
    }

    // Update the request status
    const updatedRequest = await prisma.rescheduleRequest.update({
      where: { id: requestId },
      data: {
        status,
        adminNotes
      }
    });

    res.status(200).json({ success: true, message: `Request successfully ${status.toLowerCase()}`, data: updatedRequest });
  } catch (error) {
    console.error('[API] Error resolving request:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve request' });
  }
});

// ══════════════════════════════════════════════════════════════
// PHASE 3 — EXCEL BULK UPLOAD ENDPOINTS
// All three endpoints accept: { fileBase64: string, collegeId?: number }
// The client sends the file as a base64-encoded string inside JSON.
// ══════════════════════════════════════════════════════════════

// Helper: decode base64 → xlsx workbook → first sheet as JSON rows
function parseXlsxBase64(fileBase64) {
  const buffer = Buffer.from(fileBase64, 'base64');
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, { defval: '' });
}

// ── POST /api/admin/upload-students ─────────────────────────────────────
/**
 * مسار رفع الطلاب جماعياً عبر فك معالجة ملفات Excel المرفوعة.
 * 
 * البيانات الواردة (Payload):
 * - fileBase64: سلسلة بايتات الإكسل مرمز بـ Base64 (string).
 * - collegeId: معرف الكلية المستهدفة بالإدخال (number).
 * البيانات الصادرة (Response):
 * - success: true
 * - message: إحصائية بالصفوف المنشأة والمحذوفة والمجتازة.
 * - data: نتائج تفصيلية بالأخطاء والمنشئين.
 */
router.post('/admin/upload-students', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { fileBase64, collegeId: reqCollegeId } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ success: false, error: 'fileBase64 is required' });
    }

    // استخلاص معرف الكلية بناءً على الرتبة لتجنب الاختراقات الصلاحية
    const targetCollegeId = req.user.role === 'SUPER_ADMIN'
      ? parseInt(reqCollegeId)
      : parseInt(req.user.collegeId);

    if (!targetCollegeId) {
      return res.status(400).json({ success: false, error: 'collegeId is required for SUPER_ADMIN uploads' });
    }

    const results = await excelParserService.uploadStudents(fileBase64, targetCollegeId);

    res.status(200).json({
      success: true,
      message: `Bulk upload complete: ${results.created} created, ${results.skipped} skipped`,
      data: results
    });
  } catch (error) {
    console.error('[API] upload-students error:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to process student upload' });
  }
});


// ── POST /api/admin/upload-schedules ────────────────────────────────────
/**
 * مسار رفع الحصص والجدول الدراسي الأسبوعي جماعياً من ملف Excel.
 * 
 * البيانات الواردة (Payload):
 * - fileBase64: سلسلة ملف الإكسل مرمز بـ Base64 (string).
 * - collegeId: معرف الكلية التابع لها الجدول (number).
 */
router.post('/admin/upload-schedules', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { fileBase64, collegeId: reqCollegeId } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ success: false, error: 'fileBase64 is required' });
    }

    const targetCollegeId = req.user.role === 'SUPER_ADMIN'
      ? parseInt(reqCollegeId)
      : parseInt(req.user.collegeId);

    if (!targetCollegeId) {
      return res.status(400).json({ success: false, error: 'collegeId is required for SUPER_ADMIN uploads' });
    }

    const results = await excelParserService.uploadSchedules(fileBase64, targetCollegeId);

    res.status(200).json({
      success: true,
      message: `Bulk upload complete: ${results.created} created, ${results.skipped} skipped`,
      data: results
    });
  } catch (error) {
    console.error('[API] upload-schedules error:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to process schedule upload' });
  }
});

// ── POST /api/admin/upload-exams ────────────────────────────────────────
/**
 * مسار رفع وتسكين جداول الامتحانات النهائية جماعياً من ملف Excel.
 * 
 * البيانات الواردة (Payload):
 * - fileBase64: سلسلة ملف الإكسل مرمز بـ Base64 (string).
 * - collegeId: معرف الكلية المستهدفة (number).
 */
router.post('/admin/upload-exams', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { fileBase64, collegeId: reqCollegeId } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ success: false, error: 'fileBase64 is required' });
    }

    const targetCollegeId = req.user.role === 'SUPER_ADMIN'
      ? parseInt(reqCollegeId)
      : parseInt(req.user.collegeId);

    if (!targetCollegeId) {
      return res.status(400).json({ success: false, error: 'collegeId is required for SUPER_ADMIN uploads' });
    }

    const results = await excelParserService.uploadExams(fileBase64, targetCollegeId);

    res.status(200).json({
      success: true,
      message: `Bulk upload complete: ${results.created} created, ${results.skipped} skipped`,
      data: results
    });
  } catch (error) {
    console.error('[API] upload-exams error:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to process exam upload' });
  }
});

// Global developer routes check
router.use('/admin/dev', verifyToken, isSuperAdmin);
router.use('/dev', verifyToken, isSuperAdmin);

// Verification endpoint for Developer Passcode
// SECURITY: requires valid SUPER_ADMIN JWT + DB-verified developer identity
router.post('/admin/dev/verify-key', verifyToken, isSuperAdmin, (req, res) => {
  const { passcode } = req.body;
  const devKey = process.env.DEV_PORTAL_KEY;
  if (!devKey) {
    console.error('[DevPortal] DEV_PORTAL_KEY is not set in environment variables.');
    return res.status(503).json({ success: false, error: 'Developer portal key not configured on server.' });
  }
  if (passcode === devKey) {
    return res.status(200).json({ success: true });
  }
  return res.status(401).json({ success: false, error: 'رمز مرور المطور غير صحيح' });
});

// ── DEV PORTAL INSTITUTION HIERARCHY MANAGEMENT ───────────────────────

// 1. GET /api/admin/dev/tree - Fetch governorates, universities, colleges, departments, and majors
router.get('/admin/dev/tree', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const governorates = await prisma.governorate.findMany({
      include: {
        universities: {
          orderBy: [
            { sortIndex: 'asc' },
            { name: 'asc' }
          ],
          include: {
            colleges: {
              orderBy: [
                { sortIndex: 'asc' },
                { name: 'asc' }
              ],
              include: {
                departments: {
                  include: {
                    majors: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
    res.status(200).json({ success: true, data: governorates });
  } catch (error) {
    console.error('[API] Fetch dev tree error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch institution tree' });
  }
});

// 2. POST /api/admin/dev/governorate - Create or Update Governorate
router.post('/admin/dev/governorate', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { id, name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Governorate name is required' });
    }
    let gov;
    if (id) {
      gov = await prisma.governorate.update({
        where: { id },
        data: { name }
      });
    } else {
      gov = await prisma.governorate.create({
        data: { name }
      });
    }
    res.status(200).json({ success: true, data: gov });
  } catch (error) {
    console.error('[API] Save governorate error:', error);
    res.status(500).json({ success: false, error: 'Failed to save governorate: ' + error.message });
  }
});

// 3. POST /api/admin/dev/university - Create or Update University
router.post('/admin/dev/university', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { id, name, slug, themeColor, logoUrl, governorateId, sortIndex } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ success: false, error: 'Name and slug are required' });
    }
    const parsedSortIndex = sortIndex !== undefined ? parseInt(sortIndex) : undefined;
    let uni;
    if (id) {
      uni = await prisma.university.update({
        where: { id: parseInt(id) },
        data: { name, slug, themeColor, logoUrl, governorateId, sortIndex: parsedSortIndex }
      });
    } else {
      uni = await prisma.university.create({
        data: { name, slug, themeColor, logoUrl, governorateId, sortIndex: parsedSortIndex || 0 }
      });
    }
    res.status(200).json({ success: true, data: uni });
  } catch (error) {
    console.error('[API] Save university error:', error);
    res.status(500).json({ success: false, error: 'Failed to save university: ' + error.message });
  }
});

// 4. POST /admin/dev/college - Create or Update College
router.post('/admin/dev/college', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { id, name, slug, location, universityId, sortIndex } = req.body;
    if (!name || !slug || !universityId) {
      return res.status(400).json({ success: false, error: 'Name, slug, and universityId are required' });
    }
    const parsedSortIndex = sortIndex !== undefined ? parseInt(sortIndex) : undefined;
    let college;
    if (id) {
      college = await prisma.college.update({
        where: { id: parseInt(id) },
        data: { name, slug, location, universityId: parseInt(universityId), sortIndex: parsedSortIndex }
      });
    } else {
      college = await prisma.college.create({
        data: { name, slug, location, universityId: parseInt(universityId), sortIndex: parsedSortIndex || 0 }
      });
    }
    res.status(200).json({ success: true, data: college });
  } catch (error) {
    console.error('[API] Save college error:', error);
    res.status(500).json({ success: false, error: 'Failed to save college: ' + error.message });
  }
});

// 5. POST /admin/dev/department - Create or Update Department
router.post('/admin/dev/department', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { id, name, collegeId } = req.body;
    if (!name || !collegeId) {
      return res.status(400).json({ success: false, error: 'Name and collegeId are required' });
    }
    let dept;
    if (id) {
      dept = await prisma.department.update({
        where: { id: parseInt(id) },
        data: { name, collegeId: parseInt(collegeId) }
      });
    } else {
      dept = await prisma.department.create({
        data: { name, collegeId: parseInt(collegeId) }
      });
    }
    res.status(200).json({ success: true, data: dept });
  } catch (error) {
    console.error('[API] Save department error:', error);
    res.status(500).json({ success: false, error: 'Failed to save department: ' + error.message });
  }
});

// 6. POST /admin/dev/major - Create or Update Major
router.post('/admin/dev/major', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { id, name, departmentId } = req.body;
    if (!name || !departmentId) {
      return res.status(400).json({ success: false, error: 'Name and departmentId are required' });
    }
    let major;
    if (id) {
      major = await prisma.major.update({
        where: { id: parseInt(id) },
        data: { name, departmentId: parseInt(departmentId) }
      });
    } else {
      major = await prisma.major.create({
        data: { name, departmentId: parseInt(departmentId) }
      });
    }
    res.status(200).json({ success: true, data: major });
  } catch (error) {
    console.error('[API] Save major error:', error);
    res.status(500).json({ success: false, error: 'Failed to save major: ' + error.message });
  }
});

// 7. DELETE /api/admin/dev/governorate/:id - Delete Governorate
router.delete('/admin/dev/governorate/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { id } = req.params;
    const uniCount = await prisma.university.count({ where: { governorateId: id } });
    if (uniCount > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete: Governorate contains universities' });
    }
    await prisma.governorate.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Governorate deleted successfully' });
  } catch (error) {
    console.error('[API] Delete governorate error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete governorate: ' + error.message });
  }
});

// 8. DELETE /api/admin/dev/university/:id - Delete University
router.delete('/admin/dev/university/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const uniId = parseInt(req.params.id);
    const collegeCount = await prisma.college.count({ where: { universityId: uniId } });
    if (collegeCount > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete: University contains colleges' });
    }
    await prisma.university.delete({ where: { id: uniId } });
    res.status(200).json({ success: true, message: 'University deleted successfully' });
  } catch (error) {
    console.error('[API] Delete university error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete university: ' + error.message });
  }
});

// 8b. DELETE /admin/dev/college/:id - Delete College
router.delete('/admin/dev/college/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const collegeId = parseInt(req.params.id);
    if (isNaN(collegeId)) {
      return res.status(400).json({ success: false, error: 'Invalid College ID' });
    }

    const deptCount = await prisma.department.count({ where: { collegeId } });
    if (deptCount > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete: College contains departments' });
    }

    const studentCount = await prisma.student.count({ where: { collegeId } });
    if (studentCount > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete: College contains students' });
    }

    const groupCount = await prisma.group.count({ where: { collegeId } });
    if (groupCount > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete: College contains academic groups' });
    }

    const roomCount = await prisma.room.count({ where: { collegeId } });
    if (roomCount > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete: College contains rooms' });
    }

    const lecturerCount = await prisma.lecturer.count({ where: { collegeId } });
    if (lecturerCount > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete: College contains lecturers' });
    }

    await prisma.college.delete({ where: { id: collegeId } });
    res.status(200).json({ success: true, message: 'College deleted successfully' });
  } catch (error) {
    console.error('[API] Delete college error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete college: ' + error.message });
  }
});

// 8c. DELETE /admin/dev/department/:id - Delete Department
router.delete('/admin/dev/department/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const deptId = parseInt(req.params.id);
    if (isNaN(deptId)) {
      return res.status(400).json({ success: false, error: 'Invalid Department ID' });
    }

    const majorCount = await prisma.major.count({ where: { departmentId: deptId } });
    if (majorCount > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete: Department contains majors' });
    }

    await prisma.department.delete({ where: { id: deptId } });
    res.status(200).json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    console.error('[API] Delete department error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete department: ' + error.message });
  }
});

// 8d. DELETE /admin/dev/major/:id - Delete Major
router.delete('/admin/dev/major/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const majorId = parseInt(req.params.id);
    if (isNaN(majorId)) {
      return res.status(400).json({ success: false, error: 'Invalid Major ID' });
    }

    const studentCount = await prisma.student.count({ where: { majorId } });
    if (studentCount > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete: Major contains students' });
    }

    const groupCount = await prisma.group.count({ where: { majorId } });
    if (groupCount > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete: Major contains academic groups' });
    }

    await prisma.major.delete({ where: { id: majorId } });
    res.status(200).json({ success: true, message: 'Major deleted successfully' });
  } catch (error) {
    console.error('[API] Delete major error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete major: ' + error.message });
  }
});

// ── NEW DEV PORTAL TELEMETRY & SYSTEM CONTROL ─────────────────────────

// 1. GET /api/admin/dev/dashboard-telemetry
router.get('/admin/dev/dashboard-telemetry', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }

    const telemetryData = await adminService.getTelemetry();

    res.status(200).json({
      success: true,
      data: telemetryData
    });
  } catch (error) {
    console.error('[API] Fetch telemetry error:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch telemetry data' });
  }
});

// 2. POST /api/admin/dev/toggle-setting
router.post('/admin/dev/toggle-setting', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }

    const { key, value } = req.body;
    const systemSettings = require('../services/systemSettings');

    const validKeys = [
      'debugMode', 'maintenanceMode', 'verboseLogging',
      'disableAttendance', 'disableExams', 'disableLibrary',
      'disableMap', 'disableSchedules', 'academicYear',
      'currentSemester', 'allowStudentProfileEdit', 'requireGoogleLink',
      'otpExpiryMinutes', 'enforceCaptcha',
      'otaThemeColor', 'otaWarningBanner', 'otaHiddenButtons'
    ];

    if (!validKeys.includes(key)) {
      return res.status(400).json({ success: false, error: 'Invalid setting key' });
    }

    if (key === 'otpExpiryMinutes') {
      systemSettings.set(key, parseInt(value) || 5);
    } else if (['academicYear', 'currentSemester', 'otaThemeColor', 'otaWarningBanner'].includes(key)) {
      systemSettings.set(key, value === 'null' || value === '' ? null : String(value));
    } else if (key === 'otaHiddenButtons') {
      let val = value;
      if (typeof value === 'string') {
        try {
          val = JSON.parse(value);
        } catch {
          val = value.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      systemSettings.set(key, Array.isArray(val) ? val : []);
    } else {
      systemSettings.set(key, !!value);
    }

    // Broadcast SSE to all clients about setting update
    const { broadcastSSE } = require('../services/notifications');
    broadcastSSE('SYSTEM_SETTINGS_UPDATE', { settings: systemSettings.getAll() });

    // Log to AuditLog
    const { recordAuditLog } = require('../services/sessionTracker');
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    await recordAuditLog('UPDATE_SETTING', 'SystemSetting', null, req.user.email, clientIp, { key, value });

    res.status(200).json({
      success: true,
      message: `Setting ${key} updated successfully.`,
      settings: systemSettings.getAll()
    });
  } catch (error) {
    console.error('[API] Toggle setting error:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle setting: ' + error.message });
  }
});

// 3. POST /api/admin/dev/actions/clear-test-data
router.post('/admin/dev/actions/clear-test-data', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }

    const { confirmText } = req.body;
    if (confirmText !== 'CONFIRM PURGE') {
      return res.status(400).json({ success: false, error: 'Must type CONFIRM PURGE to clear test data' });
    }

    console.log('[DEV ACTIONS] Purging transactional test data...');
    
    // Purge transactional tables
    await prisma.$transaction([
      prisma.attendanceRecord.deleteMany({}),
      prisma.attendance.deleteMany({}),
      prisma.seatAllocation.deleteMany({}),
      prisma.verificationCode.deleteMany({}),
      prisma.pushSubscription.deleteMany({}),
      prisma.notificationLog.deleteMany({}),
      prisma.auditLog.deleteMany({}),
      prisma.sessionLog.deleteMany({}),
      prisma.student.deleteMany({})
    ]);

    console.log('[DEV ACTIONS] Test transactional data purged successfully.');

    res.status(200).json({
      success: true,
      message: 'All student accounts and related transactional data (Attendance, VerificationCodes, Notifications, Audit/Session logs) have been purged successfully.'
    });
  } catch (error) {
    console.error('[API] Clear test data error:', error);
    res.status(500).json({ success: false, error: 'Failed to clear test data: ' + error.message });
  }
});

// 4. POST /api/admin/dev/actions/trigger-seed
router.post('/admin/dev/actions/trigger-seed', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }

    const { exec } = require('child_process');
    const seedPath = require('path').join(__dirname, '../../prisma/seed.js');
    console.log('[DEV ACTIONS] Triggering database seeding...');
    
    exec(`node "${seedPath}"`, (err, stdout, stderr) => {
      if (err) {
        console.error('[DEV ACTIONS] Seeding process failed:', err.message);
        console.error(stderr);
      } else {
        console.log('[DEV ACTIONS] Seeding completed successfully.');
        if (stdout) console.log(stdout);
      }
    });

    res.status(200).json({
      success: true,
      message: 'Database seeding triggered successfully in the background.'
    });
  } catch (error) {
    console.error('[API] Trigger seed error:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger seed: ' + error.message });
  }
});

// 5. GET /api/admin/dev/sessions
router.get('/admin/dev/sessions', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const role = req.query.role || '';
    const status = req.query.status || '';
    const collegeId = req.query.collegeId ? parseInt(req.query.collegeId) : null;
    const universityId = req.query.universityId ? parseInt(req.query.universityId) : null;
    const departmentId = req.query.departmentId ? parseInt(req.query.departmentId) : null;
    const majorId = req.query.majorId ? parseInt(req.query.majorId) : null;

    let emailFilter = null;
    if (collegeId || universityId || departmentId || majorId) {
      // Find all user emails associated with this tenant context/department/major to filter sessions
      const studentWhere = {};
      const lecturerWhere = {};
      const adminWhere = {};

      if (collegeId) {
        studentWhere.collegeId = collegeId;
        lecturerWhere.collegeId = collegeId;
        adminWhere.collegeId = collegeId;
      } else if (universityId) {
        studentWhere.college = { universityId };
        lecturerWhere.college = { universityId };
        adminWhere.universityId = universityId;
      }

      if (majorId) {
        studentWhere.majorId = majorId;
      } else if (departmentId) {
        studentWhere.major = { departmentId };
      }

      const studentEmails = await prisma.student.findMany({
        where: studentWhere,
        select: { email: true }
      });

      // Only search lecturers/admins if we aren't filtering by major/department
      let lecturerEmails = [];
      let adminEmails = [];
      if (!majorId && !departmentId) {
        lecturerEmails = await prisma.lecturer.findMany({
          where: lecturerWhere,
          select: { email: true }
        });
        adminEmails = await prisma.admin.findMany({
          where: adminWhere,
          select: { email: true }
        });
      }

      emailFilter = [
        ...studentEmails.map(s => s.email),
        ...lecturerEmails.map(l => l.email),
        ...adminEmails.map(a => a.email)
      ];
    }

    const andConditions = [];

    // Search query
    if (search) {
      andConditions.push({
        OR: [
          { userEmail: { contains: search, mode: 'insensitive' } },
          { role: { contains: search, mode: 'insensitive' } },
          { ipAddress: { contains: search, mode: 'insensitive' } }
        ]
      });
    }

    // Role filter
    if (role && role !== 'ALL') {
      andConditions.push({ role });
    }

    // Status filter
    if (status && status !== 'ALL') {
      if (status === 'ACTIVE') {
        andConditions.push({ logoutTime: null, isRevoked: false });
      } else if (status === 'REVOKED') {
        andConditions.push({ isRevoked: true });
      } else if (status === 'ENDED') {
        andConditions.push({ logoutTime: { not: null } });
      }
    }

    // Tenant email filter
    if (emailFilter) {
      andConditions.push({ userEmail: { in: emailFilter } });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const [sessions, total] = await Promise.all([
      prisma.sessionLog.findMany({
        where,
        orderBy: { loginTime: 'desc' },
        skip,
        take: limit
      }),
      prisma.sessionLog.count({ where })
    ]);

    res.status(200).json({ success: true, data: sessions, total, page, limit });
  } catch (error) {
    console.error('[API] Fetch sessions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions: ' + error.message });
  }
});

// 6. POST /api/admin/dev/sessions/revoke
router.post('/admin/dev/sessions/revoke', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }

    const session = await prisma.sessionLog.update({
      where: { id: parseInt(sessionId) },
      data: { isRevoked: true, logoutTime: new Date() }
    });

    // Log in audit log
    const { recordAuditLog } = require('../services/sessionTracker');
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    await recordAuditLog('FORCE_LOGOUT', 'SessionLog', parseInt(sessionId), req.user.email, clientIp, { sessionUser: session.userEmail });

    res.status(200).json({ success: true, message: 'Session revoked successfully.', data: session });
  } catch (error) {
    console.error('[API] Revoke session error:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke session: ' + error.message });
  }
});

// 6b. GET /api/admin/users/indexed-directory
router.get('/admin/users/indexed-directory', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const role = req.query.role || 'ALL'; // ALL | STUDENT | LECTURER | ADMIN
    const departmentId = req.query.departmentId ? parseInt(req.query.departmentId) : null;
    const majorId = req.query.majorId ? parseInt(req.query.majorId) : null;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const collegeId = req.query.collegeId ? parseInt(req.query.collegeId) : null;

    let collegeFilter = {};
    if (req.user.role !== 'SUPER_ADMIN') {
      collegeFilter = { collegeId: req.user.collegeId };
    } else if (collegeId) {
      collegeFilter = { collegeId };
    }

    const usersList = [];

    // 1. Fetch Students
    if (role === 'ALL' || role === 'STUDENT') {
      const studentWhere = { ...collegeFilter };
      if (majorId) {
        studentWhere.majorId = majorId;
      } else if (departmentId) {
        studentWhere.major = { departmentId };
      }
      if (search) {
        studentWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      const students = await prisma.student.findMany({
        where: studentWhere,
        include: { major: { include: { department: true } }, level: true, group: true },
        orderBy: { name: 'asc' }
      });

      students.forEach(s => {
        usersList.push({
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          role: 'STUDENT',
          department: s.major?.department?.name || 'N/A',
          major: s.major?.name || 'N/A',
          level: s.level?.name || 'N/A',
          group: s.group?.name || 'N/A',
          collegeId: s.collegeId
        });
      });
    }

    // 2. Fetch Lecturers
    if ((role === 'ALL' || role === 'LECTURER') && !majorId && !departmentId) {
      const lecturerWhere = { ...collegeFilter };
      if (search) {
        lecturerWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      const lecturers = await prisma.lecturer.findMany({
        where: lecturerWhere,
        orderBy: { name: 'asc' }
      });

      lecturers.forEach(l => {
        usersList.push({
          id: l.id,
          name: l.name,
          email: l.email,
          phone: l.phone,
          role: 'LECTURER',
          department: 'N/A',
          major: 'N/A',
          level: 'N/A',
          group: 'N/A',
          collegeId: l.collegeId
        });
      });
    }

    // 3. Fetch Admins
    if ((role === 'ALL' || role === 'ADMIN') && !majorId && !departmentId) {
      const adminWhere = {};
      if (req.user.role !== 'SUPER_ADMIN') {
        adminWhere.collegeId = req.user.collegeId;
      } else if (collegeId) {
        adminWhere.collegeId = collegeId;
      }
      if (search) {
        adminWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      const admins = await prisma.admin.findMany({
        where: adminWhere,
        orderBy: { name: 'asc' }
      });

      admins.forEach(a => {
        usersList.push({
          id: a.id,
          name: a.name,
          email: a.email,
          phone: null,
          role: a.role,
          department: 'N/A',
          major: 'N/A',
          level: 'N/A',
          group: 'N/A',
          collegeId: a.collegeId
        });
      });
    }

    // For each user in usersList, fetch session counts and audit counts in memory
    const enrichedUsers = [];
    if (usersList.length > 0) {
      const emails = usersList.map(u => u.email);

      const [activeSessions, allSessions, auditLogs] = await Promise.all([
        prisma.sessionLog.groupBy({
          by: ['userEmail'],
          where: { userEmail: { in: emails }, logoutTime: null, isRevoked: false },
          _count: { id: true }
        }),
        prisma.sessionLog.groupBy({
          by: ['userEmail'],
          where: { userEmail: { in: emails } },
          _count: { id: true }
        }),
        prisma.auditLog.groupBy({
          by: ['userEmail'],
          where: { userEmail: { in: emails } },
          _count: { id: true }
        })
      ]);

      const activeSessionsMap = new Map(activeSessions.map(item => [item.userEmail, item._count.id]));
      const allSessionsMap = new Map(allSessions.map(item => [item.userEmail, item._count.id]));
      const auditLogsMap = new Map(auditLogs.map(item => [item.userEmail, item._count.id]));

      usersList.forEach(u => {
        enrichedUsers.push({
          ...u,
          activeSessionsCount: activeSessionsMap.get(u.email) || 0,
          totalSessionsCount: allSessionsMap.get(u.email) || 0,
          totalActivitiesCount: auditLogsMap.get(u.email) || 0
        });
      });
    }

    res.status(200).json({ success: true, data: enrichedUsers });
  } catch (error) {
    console.error('[API] Indexed directory fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch indexed directory: ' + error.message });
  }
});

// 6c. GET /api/admin/users/details
router.get('/admin/users/details', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }
    const { email, role } = req.query;
    if (!email || !role) {
      return res.status(400).json({ success: false, error: 'Email and role are required' });
    }

    const adminScope = getModelScope(req, 'Student');

    let userProfile = null;
    let sessionLogs = [];
    let extraData = {};

    // Fetch sessions from SessionLog
    sessionLogs = await prisma.sessionLog.findMany({
      where: { userEmail: email },
      orderBy: { loginTime: 'desc' },
      take: 30
    });

    // Fetch audit logs (what they did)
    const auditLogs = await prisma.auditLog.findMany({
      where: { userEmail: email },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    if (role === 'STUDENT') {
      userProfile = await prisma.student.findFirst({
        where: { email, ...adminScope },
        include: {
          major: { include: { department: true } },
          level: true,
          group: true,
          college: true
        }
      });

      if (userProfile) {
        // Fetch student attendance records
        const attendances = await prisma.attendanceRecord.findMany({
          where: { studentId: userProfile.id },
          include: {
            schedule: {
              include: { subject: true, room: true }
            }
          },
          orderBy: { date: 'desc' },
          take: 30
        });

        // Fetch student completed goals
        const goals = await prisma.studentGoalCompletion.findMany({
          where: { studentId: userProfile.id },
          include: {
            academicGoal: {
              include: { subject: true }
            }
          },
          orderBy: { completedAt: 'desc' },
          take: 30
        });

        // Fetch notifications
        const notifications = await prisma.notificationLog.findMany({
          where: {
            OR: [
              { studentId: userProfile.id },
              { groupId: userProfile.groupId, studentId: null }
            ]
          },
          orderBy: { sentTime: 'desc' },
          take: 30
        });

        extraData = { attendances, goals, notifications };
      }
    } else if (role === 'LECTURER') {
      const lecScope = getModelScope(req, 'Lecturer');
      userProfile = await prisma.lecturer.findFirst({
        where: { email, ...lecScope },
        include: { college: true }
      });

      if (userProfile) {
        const schedules = await prisma.schedule.findMany({
          where: { lecturerId: userProfile.id },
          include: { subject: true, room: true, group: true },
          orderBy: [
            { dayOfWeek: 'asc' },
            { startTime: 'asc' }
          ]
        });

        const requests = await prisma.rescheduleRequest.findMany({
          where: { lecturerId: userProfile.id },
          include: {
            schedule: { include: { subject: true } },
            newRoom: true
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        });

        extraData = { schedules, requests };
      }
    } else {
      // For admins (SUPER_ADMIN, UNI_ADMIN, COLLEGE_ADMIN)
      userProfile = await prisma.admin.findFirst({
        where: { email },
        include: { college: true, university: true }
      });
    }

    if (!userProfile) {
      return res.status(404).json({ success: false, error: 'User profile not found in scoped records' });
    }

    res.status(200).json({
      success: true,
      profile: userProfile,
      sessions: sessionLogs,
      auditLogs: auditLogs,
      extra: extraData
    });
  } catch (error) {
    console.error('[API] Fetch user details error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user details: ' + error.message });
  }
});

// 7. GET /api/admin/dev/audit-logs
router.get('/admin/dev/audit-logs', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const page         = parseInt(req.query.page)  || 1;
    const limit        = parseInt(req.query.limit) || 50;
    const skip         = (page - 1) * limit;
    const search       = req.query.search ? String(req.query.search).trim() : '';
    const action       = req.query.action ? String(req.query.action).trim() : '';

    const where = {};
    if (search) {
      where.OR = [
        { userEmail:  { contains: search, mode: 'insensitive' } },
        { action:     { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { ipAddress:  { contains: search, mode: 'insensitive' } }
      ];
    }
    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);

    res.status(200).json({ success: true, data: logs, total, page, limit });
  } catch (error) {
    console.error('[API] Fetch audit logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs: ' + error.message });
  }
});

// 8. GET /api/admin/dev/notifications
router.get('/admin/dev/notifications', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.notificationLog.findMany({
        orderBy: { sentTime: 'desc' },
        skip,
        take: limit,
        include: {
          student: { select: { name: true, email: true } },
          group: { select: { name: true } }
        }
      }),
      prisma.notificationLog.count()
    ]);

    res.status(200).json({ success: true, data: logs, total, page, limit });
  } catch (error) {
    console.error('[API] Fetch notifications logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notification logs: ' + error.message });
  }
});

// 9. POST /api/admin/dev/notifications
router.post('/admin/dev/notifications', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { groupId, collegeId, universityId, studentId, message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message body is required' });
    }

    const { broadcastSSE } = require('../services/notifications');
    const { recordAuditLog } = require('../services/sessionTracker');
    
    let targetCount = 0;
    let targetStudents = [];

    if (studentId) {
      const student = await prisma.student.findUnique({ where: { id: parseInt(studentId) } });
      if (student) targetStudents.push(student);
    } else if (groupId) {
      targetStudents = await prisma.student.findMany({ where: { groupId: parseInt(groupId) } });
    } else if (collegeId) {
      targetStudents = await prisma.student.findMany({ where: { collegeId: parseInt(collegeId) } });
    } else if (universityId) {
      targetStudents = await prisma.student.findMany({
        where: { college: { universityId: parseInt(universityId) } }
      });
    } else {
      targetStudents = await prisma.student.findMany();
    }

    const { sendStudentPushNotification } = require('../services/notifications');
    const broadcastId = require('crypto').randomUUID();
    
    for (const student of targetStudents) {
      try {
        await prisma.notificationLog.create({
          data: {
            studentId: student.id,
            groupId: student.groupId,
            message,
            status: 'SENT',
            broadcastId
          }
        });
        
        broadcastSSE('NEW_NOTIFICATION', { studentId: student.id, message, broadcastId });
        
        await sendStudentPushNotification(student.id, {
          title: 'تنبيه إداري عاجل 📢',
          body: message,
          url: '/student/home',
          broadcastId
        });
        
        targetCount++;
      } catch (err) {
        console.error(`Failed to send alert to student ${student.id}:`, err.message);
      }
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    await recordAuditLog('BROADCAST_ALERT', 'NotificationLog', null, req.user.email, clientIp, {
      message,
      targetStudentsCount: targetStudents.length,
      sentSuccessfully: targetCount
    });

    res.status(200).json({ success: true, message: `Alert dispatched successfully to ${targetCount} students.` });
  } catch (error) {
    console.error('[API] Broadcast alert error:', error);
    res.status(500).json({ success: false, error: 'Failed to deploy alert: ' + error.message });
  }
});

// 10. GET /api/admin/levels
router.get('/admin/levels', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req.user)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const levels = await prisma.level.findMany({
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: levels });
  } catch (error) {
    console.error('[API] Get levels error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch levels: ' + error.message });
  }
});

// 11. POST /api/admin/levels
router.post('/admin/levels', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { id, name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Level name is required' });
    }

    let level;
    if (id) {
      level = await prisma.level.update({
        where: { id: parseInt(id) },
        data: { name }
      });
    } else {
      level = await prisma.level.create({
        data: { name }
      });
    }

    const { recordAuditLog } = require('../services/sessionTracker');
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    await recordAuditLog(id ? 'UPDATE_LEVEL' : 'CREATE_LEVEL', 'Level', level.id, req.user.email, clientIp, { levelName: name });

    res.status(200).json({ success: true, data: level });
  } catch (error) {
    console.error('[API] Save level error:', error);
    res.status(500).json({ success: false, error: 'Failed to save level: ' + error.message });
  }
});

// 12. DELETE /api/admin/levels/:id
router.delete('/admin/levels/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const id = parseInt(req.params.id);
    const existing = await prisma.level.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Level not found' });
    }
    
    await prisma.level.delete({ where: { id } });

    const { recordAuditLog } = require('../services/sessionTracker');
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    await recordAuditLog('DELETE_LEVEL', 'Level', id, req.user.email, clientIp, { levelName: existing.name });

    res.status(200).json({ success: true, message: 'Level deleted successfully' });
  } catch (error) {
    console.error('[API] Delete level error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete level: ' + error.message });
  }
});

// 13. POST /api/admin/subjects
router.post('/admin/subjects', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req.user)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id, name, code, type, collegeId } = req.body;
    if (!name || !code || !type || !collegeId) {
      return res.status(400).json({ success: false, error: 'Name, code, type, and collegeId are required' });
    }

    if (req.user.role !== 'SUPER_ADMIN') {
      if (parseInt(collegeId) !== req.user.collegeId) {
        return res.status(403).json({ success: false, error: 'Unauthorized to modify this college' });
      }
    }

    let subject;
    if (id) {
      subject = await prisma.subject.update({
        where: { id: parseInt(id) },
        data: { name, code, type, collegeId: parseInt(collegeId) }
      });
    } else {
      subject = await prisma.subject.create({
        data: { name, code, type, collegeId: parseInt(collegeId) }
      });
    }

    const { recordAuditLog } = require('../services/sessionTracker');
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    await recordAuditLog(id ? 'UPDATE_SUBJECT' : 'CREATE_SUBJECT', 'Subject', subject.id, req.user.email, clientIp, { subjectName: name });

    res.status(200).json({ success: true, data: subject });
  } catch (error) {
    console.error('[API] Save subject error:', error);
    res.status(500).json({ success: false, error: 'Failed to save subject: ' + error.message });
  }
});

// 14. DELETE /api/admin/subjects/:id
router.delete('/admin/subjects/:id', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req.user)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const id = parseInt(req.params.id);
    const existing = await prisma.subject.findFirst({
      where: { id, ...getModelScope(req.user, 'Subject') }
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Subject not found or unauthorized' });
    }

    await prisma.subject.delete({ where: { id } });

    const { recordAuditLog } = require('../services/sessionTracker');
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    await recordAuditLog('DELETE_SUBJECT', 'Subject', id, req.user.email, clientIp, { subjectName: existing.name });

    res.status(200).json({ success: true, message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('[API] Delete subject error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete subject: ' + error.message });
  }
});

// ── NEW TENANT CONFIGS APIs ──────────────────────────────────────────

// 5. GET /api/admin/dev/tenant-configs
router.get('/admin/dev/tenant-configs', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }

    const universities = await prisma.university.findMany({
      include: { tenantConfig: true },
      orderBy: { name: 'asc' }
    });
    
    const colleges = await prisma.college.findMany({
      include: { tenantConfig: true, university: true },
      orderBy: { name: 'asc' }
    });

    res.status(200).json({
      success: true,
      data: {
        universities,
        colleges
      }
    });
  } catch (error) {
    console.error('[API] Get tenant configs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tenant configurations: ' + error.message });
  }
});

// 6. POST /api/admin/dev/tenant-configs
async function saveTenantConfigFn(req, res) {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }

    let { id, universityId, collegeId, themeColor, logoUrl, customDomain, databaseUrl, enabledFeatures } = req.body;

    if (req.params.uniId) universityId = req.params.uniId;
    if (req.params.collegeId) collegeId = req.params.collegeId;

    let config;
    if (id) {
      config = await prisma.tenantConfig.update({
        where: { id: parseInt(id) },
        data: {
          themeColor,
          logoUrl,
          customDomain,
          databaseUrl,
          enabledFeatures: enabledFeatures || {}
        }
      });
    } else {
      const uId = universityId ? parseInt(universityId) : null;
      const cId = collegeId ? parseInt(collegeId) : null;
      const whereClause = uId ? { universityId: uId } : { collegeId: cId };
      const existing = await prisma.tenantConfig.findFirst({ where: whereClause });

      if (existing) {
        config = await prisma.tenantConfig.update({
          where: { id: existing.id },
          data: {
            themeColor,
            logoUrl,
            customDomain,
            databaseUrl,
            enabledFeatures: enabledFeatures || {}
          }
        });
      } else {
        config = await prisma.tenantConfig.create({
          data: {
            universityId: uId,
            collegeId: cId,
            themeColor,
            logoUrl,
            customDomain,
            databaseUrl,
            enabledFeatures: enabledFeatures || {}
          }
        });
      }
    }

    // Update sortIndex on the University/College if specified
    if (req.body.sortIndex !== undefined) {
      const parsedSortIndex = parseInt(req.body.sortIndex) || 0;
      if (universityId) {
        await prisma.university.update({
          where: { id: parseInt(universityId) },
          data: { sortIndex: parsedSortIndex }
        });
      } else if (collegeId) {
        await prisma.college.update({
          where: { id: parseInt(collegeId) },
          data: { sortIndex: parsedSortIndex }
        });
      }
    }

    res.status(200).json({ success: true, data: config });
  } catch (error) {
    console.error('[API] Save tenant config error:', error);
    res.status(500).json({ success: false, error: 'Failed to save tenant configuration: ' + error.message });
  }
}

router.post('/admin/dev/tenant-configs', verifyToken, saveTenantConfigFn);
router.post('/admin/dev/tenant-configs/universities/:uniId', verifyToken, saveTenantConfigFn);
router.post('/admin/dev/tenant-configs/colleges/:collegeId', verifyToken, saveTenantConfigFn);


// ── NEW: Subject & Doctor (Lecturer) Creation and Management Endpoints ──

// Get all subjects
router.get('/admin/subjects', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { role, collegeId, universityId } = req.user;
    let whereClause = {};

    if (role === 'COLLEGE_ADMIN') {
      // PATCH [SEC]: Strictly scope to this admin's college only
      if (!collegeId) return res.status(400).json({ success: false, error: 'No college association for this admin' });
      whereClause.collegeId = parseInt(collegeId);
    } else if (role === 'UNI_ADMIN') {
      // PATCH [SEC]: UNI_ADMIN was missing scope — now scoped to their university's colleges
      if (!universityId) return res.status(400).json({ success: false, error: 'No university association for this admin' });
      whereClause.college = { universityId: parseInt(universityId) };
    } else if (role === 'SUPER_ADMIN') {
      // SUPER_ADMIN may optionally filter by a specific college via query param
      const qCollegeId = req.query.collegeId;
      if (qCollegeId) {
        whereClause.collegeId = parseInt(qCollegeId);
      }
    }

    const subjects = await prisma.subject.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: subjects });
  } catch (error) {
    console.error('[API] Get subjects error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subjects: ' + error.message });
  }
});

// Get all lecturers (doctors)
router.get('/admin/lecturers', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { role, collegeId, universityId } = req.user;
    let whereClause = {};

    if (role === 'COLLEGE_ADMIN') {
      // PATCH [SEC]: Strictly scope to this admin's college only
      if (!collegeId) return res.status(400).json({ success: false, error: 'No college association for this admin' });
      whereClause.collegeId = parseInt(collegeId);
    } else if (role === 'UNI_ADMIN') {
      // PATCH [SEC]: UNI_ADMIN was missing scope — now scoped to their university's colleges
      if (!universityId) return res.status(400).json({ success: false, error: 'No university association for this admin' });
      whereClause.college = { universityId: parseInt(universityId) };
    } else if (role === 'SUPER_ADMIN') {
      // SUPER_ADMIN may optionally filter by a specific college via query param
      const qCollegeId = req.query.collegeId;
      if (qCollegeId) {
        whereClause.collegeId = parseInt(qCollegeId);
      }
    }

    const lecturers = await prisma.lecturer.findMany({
      where: whereClause,
      include: { college: true },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: lecturers });
  } catch (error) {
    console.error('[API] Get lecturers error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch lecturers: ' + error.message });
  }
});

// Create a new lecturer (doctor)
router.post('/admin/lecturers', verifyToken, async (req, res) => {
  try {
    const { name, email, password, phone, collegeId, subjectId } = req.body;
    const userRole = req.user.role;
    const adminCollegeId = req.user.collegeId;

    let targetCollegeId;
    if (userRole === 'COLLEGE_ADMIN') {
      if (!adminCollegeId) return res.status(400).json({ success: false, error: 'No college association for this admin' });
      targetCollegeId = parseInt(adminCollegeId);
    } else {
      if (!collegeId) {
        return res.status(400).json({ success: false, error: 'College ID is required' });
      }
      targetCollegeId = parseInt(collegeId);
    }

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }

    // Check if email already registered
    const existing = await prisma.lecturer.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const lecturer = await prisma.lecturer.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone: phone || null,
        collegeId: targetCollegeId
      }
    });

    // If subjectId is specified, find schedules matching this subjectId in this college and associate this lecturer
    if (subjectId) {
      const parsedSubjectId = parseInt(subjectId);
      await prisma.schedule.updateMany({
        where: {
          subjectId: parsedSubjectId,
          collegeId: targetCollegeId
        },
        data: {
          lecturerId: lecturer.id,
          lecturerName: lecturer.name
        }
      });
    }

    res.status(201).json({ success: true, data: lecturer });
  } catch (error) {
    console.error('[API] Create lecturer error:', error);
    res.status(500).json({ success: false, error: 'Failed to create lecturer: ' + error.message });
  }
});

// Delete a lecturer (doctor)
router.delete('/admin/lecturers/:id', verifyToken, async (req, res) => {
  try {
    const lecturerId = parseInt(req.params.id);
    if (isNaN(lecturerId)) {
      return res.status(400).json({ success: false, error: 'Invalid Lecturer ID' });
    }

    const { role, collegeId } = req.user;
    
    // If COLLEGE_ADMIN, verify that the lecturer is in the same college
    if (role === 'COLLEGE_ADMIN') {
      const lecturer = await prisma.lecturer.findUnique({ where: { id: lecturerId } });
      if (!lecturer || lecturer.collegeId !== parseInt(collegeId)) {
        return res.status(403).json({ success: false, error: 'Access denied. You can only delete lecturers from your own college.' });
      }
    }

    await prisma.lecturer.delete({ where: { id: lecturerId } });
    res.status(200).json({ success: true, message: 'Lecturer deleted successfully' });
  } catch (error) {
    console.error('[API] Delete lecturer error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete lecturer: ' + error.message });
  }
});

// Trigger automated check-in notifications manually (Admin testing endpoint)
const { sendMorningCheckin, sendAfternoonCheckin, sendDailyScheduleSummary, checkUpcomingClassesAndNotify } = require('../services/cron');
router.post('/admin/trigger-automated-notif', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { type } = req.body; // 'morning', 'afternoon', 'summary', or 'upcoming'
    if (type === 'morning') {
      await sendMorningCheckin();
      return res.status(200).json({ success: true, message: 'Morning check-in notifications triggered successfully' });
    } else if (type === 'afternoon') {
      await sendAfternoonCheckin();
      return res.status(200).json({ success: true, message: 'Afternoon check-in notifications triggered successfully' });
    } else if (type === 'summary') {
      await sendDailyScheduleSummary();
      return res.status(200).json({ success: true, message: 'Daily schedule summary notifications triggered successfully' });
    } else if (type === 'upcoming') {
      await checkUpcomingClassesAndNotify();
      return res.status(200).json({ success: true, message: 'Upcoming lecture pre-alerts triggered successfully' });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid notification type. Must be morning, afternoon, summary, or upcoming' });
    }
  } catch (error) {
    console.error('[API] Error manual trigger automated notification:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger notifications: ' + error.message });
  }
});

// POST Broadcast to a specific Major (Specialty)
router.post('/broadcasts/major', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { majorId, message } = req.body;
    if (!majorId || !message) {
      return res.status(400).json({ success: false, error: 'Major ID and Message are required' });
    }

    const parsedMajorId = parseInt(majorId);

    // PATCH [SEC]: Apply admin scope to prevent cross-tenant broadcast.
    // A COLLEGE_ADMIN must not be able to broadcast to students in another college
    // by simply guessing a majorId. The scope filter enforces college/uni boundaries.
    const adminScope = getModelScope(req, 'Student');

    // Find all students in this major — strictly within this admin's college/uni scope
    const students = await prisma.student.findMany({
      where: { majorId: parsedMajorId, ...adminScope },
      include: { pushSubscriptions: true }
    });

    if (students.length === 0) {
      return res.status(404).json({ success: false, error: 'No students found in this major' });
    }

    // Get unique group IDs of students in this major to log notification
    const groupIds = [...new Set(students.map(s => s.groupId).filter(Boolean))];

    // Log the notification for each group
    const logData = groupIds.map(gid => ({
      groupId: gid,
      message: message,
      status: 'SENT'
    }));

    if (logData.length > 0) {
      await prisma.notificationLog.createMany({
        data: logData,
        skipDuplicates: true
      });
    }

    // Broadcast live via SSE
    for (const gid of groupIds) {
      broadcastSSE('BROADCAST_MESSAGE', { groupId: gid, message });
    }

    // Send push notification to all students in this major
    const { sendStudentPushNotification } = require('../services/notifications');
    for (const student of students) {
      await sendStudentPushNotification(student.id, {
        title: 'تنبيه حسب التخصص 📢',
        body: message,
        url: '/student/home'
      });
    }

    res.status(200).json({ success: true, message: `Broadcast sent to ${students.length} students in major.` });
  } catch (error) {
    console.error('[API] Error broadcasting to major:', error);
    res.status(500).json({ success: false, error: 'Failed to broadcast to major: ' + error.message });
  }
});

// 23. POST Reset Student Password (NO plaintext passwords stored)
router.post('/admin/students/:id/reset-password', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }
    const studentId = parseInt(req.params.id);
    if (isNaN(studentId)) {
      return res.status(400).json({ success: false, error: 'Invalid Student ID' });
    }

    const adminScope = getModelScope(req, 'Student');
    const student = await prisma.student.findFirst({
      where: { id: studentId, ...adminScope }
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found or unauthorized' });
    }

    // Generate a secure, readable temporary password
    const crypto = require('crypto');
    const randomDigits = crypto.randomInt(100000, 999999).toString(); // 6 random digits
    const tempPassword = `Manar@${randomDigits}`;

    // Hash the temporary password using bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    // Update the student's password in the database
    await prisma.student.update({
      where: { id: studentId },
      data: { password: hashedPassword }
    });

    res.status(200).json({
      success: true,
      message: 'Student password reset successfully.',
      tempPassword // Return the plaintext password ONCE so the admin can copy it
    });

  } catch (error) {
    console.error('[API] Error resetting student password:', error);
    res.status(500).json({ success: false, error: 'Failed to reset student password' });
  }
});

// Master Developer Telemetry
router.get('/dev/telemetry', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }

    const systemSettings = require('../services/systemSettings');
    
    // Group students by college
    const studentGroups = await prisma.student.groupBy({
      by: ['collegeId'],
      _count: { id: true }
    });

    // Get college names
    const colleges = await prisma.college.findMany({
      select: { id: true, name: true }
    });

    const studentsPerCollege = colleges.map(c => {
      const group = studentGroups.find(g => g.collegeId === c.id);
      return {
        collegeId: c.id,
        collegeName: c.name,
        count: group ? group._count.id : 0
      };
    });

    const totalSchedules = await prisma.schedule.count();

    res.status(200).json({
      success: true,
      data: {
        studentsPerCollege,
        totalSchedules,
        uptime: process.uptime(),
        deactivatedColleges: systemSettings.get('deactivatedColleges') || []
      }
    });
  } catch (error) {
    console.error('[API] Dev telemetry error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve dev telemetry' });
  }
});

// Toggle License Kill-Switch
router.post('/dev/toggle-license', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }

    const { collegeId } = req.body;
    if (!collegeId) {
      return res.status(400).json({ success: false, error: 'College ID is required' });
    }

    const systemSettings = require('../services/systemSettings');
    let deactivated = systemSettings.get('deactivatedColleges') || [];
    const targetId = parseInt(collegeId);

    if (deactivated.includes(targetId)) {
      deactivated = deactivated.filter(id => id !== targetId);
    } else {
      deactivated.push(targetId);
    }

    systemSettings.set('deactivatedColleges', deactivated);

    res.status(200).json({
      success: true,
      message: 'License status updated successfully',
      deactivatedColleges: deactivated
    });
  } catch (error) {
    console.error('[API] Toggle license error:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle license status' });
  }
});

// NOTE: audit-logs is defined above (merged with action/tenantFilter support)
// The following Phase 1 & 2 God-Mode routes (branch-tree, branch actions, kill-switch,
// login-activity-chart, backup, notifications mark-read) are defined further below.


// GET Deep Branch Tree (University → College → Group)
router.get('/admin/dev/branch-tree', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' });
    }
    const universityId = req.query.universityId ? parseInt(req.query.universityId) : undefined;
    const systemSettings = require('../services/systemSettings');
    const suspendedGroups = systemSettings.get('suspendedGroups') || [];
    const maintenanceGroups = systemSettings.get('maintenanceGroups') || [];
    const maintenanceColleges = systemSettings.get('maintenanceColleges') || [];

    const universities = await prisma.university.findMany({
      where: universityId ? { id: universityId } : {},
      include: {
        colleges: {
          include: {
            groups: {
              select: {
                id: true, name: true,
                _count: { select: { students: true } }
              }
            },
            _count: { select: { students: true, groups: true } }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Transform into tree structure
    const tree = universities.map(uni => ({
      id: uni.id,
      name: uni.name,
      type: 'university',
      collegeCount: uni.colleges.length,
      children: uni.colleges.map(col => ({
        id: col.id,
        name: col.name,
        type: 'college',
        studentCount: col._count.students,
        maintenance: maintenanceColleges.includes(col.id),
        children: col.groups.map(grp => ({
          id: grp.id,
          name: grp.name,
          type: 'group',
          studentCount: grp._count.students,
          children: [],
          suspended: suspendedGroups.includes(grp.id),
          maintenance: maintenanceGroups.includes(grp.id),
        }))
      }))
    }));

    res.json({ success: true, data: tree });
  } catch (error) {
    console.error('[API] Branch tree error:', error);
    res.status(500).json({ success: false, error: 'Failed to build branch tree' });
  }
});

// POST Branch Action (suspend/maintenance for group or college)
router.post('/admin/dev/branch/:type/:id/:action', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' });
    }
    const { type, id, action } = req.params;
    const entityId = parseInt(id);
    const { suspended, maintenance } = req.body;

    const systemSettings = require('../services/systemSettings');

    if (type === 'group') {
      const key = action === 'suspend' ? 'suspendedGroups' : 'maintenanceGroups';
      let list = systemSettings.get(key) || [];
      if (suspended || maintenance) {
        if (!list.includes(entityId)) list.push(entityId);
      } else {
        list = list.filter(i => i !== entityId);
      }
      systemSettings.set(key, list);

      // Kick all sessions in this group via SSE
      broadcastSSE('BRANCH_ACTION', { type, id: entityId, action, suspended, maintenance });
    } else if (type === 'college') {
      const key = 'maintenanceColleges';
      let list = systemSettings.get(key) || [];
      if (maintenance) {
        if (!list.includes(entityId)) list.push(entityId);
      } else {
        list = list.filter(i => i !== entityId);
      }
      systemSettings.set(key, list);
      broadcastSSE('BRANCH_ACTION', { type, id: entityId, action, maintenance });
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: `BRANCH_${action.toUpperCase()}`,
        entityType: type.toUpperCase(),
        entityId,
        userEmail: req.user.email,
        ipAddress: req.ip || 'unknown',
        details: req.body,
      }
    });

    res.json({ success: true, message: `Branch ${action} applied to ${type} #${entityId}` });
  } catch (error) {
    console.error('[API] Branch action error:', error);
    res.status(500).json({ success: false, error: 'Failed to apply branch action' });
  }
});

// POST Global Kill Switch — Emergency system shutdown
router.post('/admin/dev/actions/global-kill-switch', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' });
    }
    const { confirm } = req.body;
    if (!confirm) {
      return res.status(400).json({ success: false, error: 'Confirmation required' });
    }

    const systemSettings = require('../services/systemSettings');

    // Activate maintenance mode (global)
    systemSettings.set('maintenanceMode', true);

    // Broadcast to all connected SSE clients to force logout
    broadcastSSE('GLOBAL_KILL_SWITCH', {
      messageAr: 'النظام في وضع الصيانة الطارئة. سيتم إعادة الاتصال قريباً.',
      messageEn: 'System is in emergency maintenance mode. Please reconnect shortly.',
      timestamp: new Date().toISOString()
    });

    // Log the kill switch action
    await prisma.auditLog.create({
      data: {
        action: 'GLOBAL_KILL_SWITCH',
        entityType: 'SYSTEM',
        entityId: null,
        userEmail: req.user.email,
        ipAddress: req.ip || 'unknown',
        details: { reason: 'Emergency kill switch activated', timestamp: new Date() },
      }
    });

    console.warn(`[⚠️ KILL SWITCH] Activated by ${req.user.email} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      message: 'Global kill switch activated. All API routes are now in maintenance mode.',
    });
  } catch (error) {
    console.error('[API] Kill switch error:', error);
    res.status(500).json({ success: false, error: 'Kill switch failed: ' + error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GOD-MODE PHASE 2 ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// GET Login Activity Chart — 24-hour hourly breakdown of logins and logouts
router.get('/admin/dev/login-activity-chart', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' });
    }

    const now   = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0); // Midnight today

    // Fetch today's sessions
    const sessions = await prisma.sessionLog.findMany({
      where: { loginTime: { gte: start } },
      select: { loginTime: true, logoutTime: true },
    });

    // Bucket by hour (0-23)
    const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, logins: 0, logouts: 0 }));
    for (const s of sessions) {
      const loginHour  = new Date(s.loginTime).getHours();
      hourly[loginHour].logins += 1;
      if (s.logoutTime) {
        const logoutHour = new Date(s.logoutTime).getHours();
        hourly[logoutHour].logouts += 1;
      }
    }

    res.json({ success: true, data: hourly });
  } catch (error) {
    console.error('[API] Login activity chart error:', error);
    res.status(500).json({ success: false, error: 'Failed to build chart data' });
  }
});

// GET Backup — Dynamic entity backup endpoint
router.get('/admin/dev/backup/:entity', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' });
    }
    const { entity } = req.params;

    const backupMap = {
      students:      () => prisma.student.findMany({ select: { id: true, name: true, email: true, idNumber: true, phone: true, collegeId: true, majorId: true, levelId: true, groupId: true, createdAt: true } }),
      lecturers:     () => prisma.lecturer.findMany({ select: { id: true, name: true, email: true, phone: true, collegeId: true, createdAt: true } }),
      schedules:     () => prisma.schedule.findMany({ include: { subject: true, room: true, group: true } }),
      groups:        () => prisma.group.findMany({ include: { major: true, level: true, college: true } }),
      rooms:         () => prisma.room.findMany({ include: { college: true } }),
      subjects:      () => prisma.subject.findMany({ include: { college: true } }),
      notifications: () => prisma.notificationLog.findMany({ orderBy: { sentTime: 'desc' }, take: 5000 }),
      auditLogs:     () => prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 10000 }),
      sessionLogs:   () => prisma.sessionLog.findMany({ orderBy: { loginTime: 'desc' }, take: 10000 }),
      universities:  () => prisma.university.findMany({ include: { colleges: true } }),
      tenantConfigs: () => prisma.tenantConfig.findMany({}),
      examSchedules: () => prisma.examSchedule.findMany({ include: { subject: true, room: true, group: true } }),
    };

    const fetcher = backupMap[entity];
    if (!fetcher) {
      return res.status(400).json({ success: false, error: `Unknown backup entity: ${entity}` });
    }

    // Log this backup action
    await prisma.auditLog.create({
      data: {
        action: 'BACKUP_EXPORT',
        entityType: entity.toUpperCase(),
        entityId: null,
        userEmail: req.user.email,
        ipAddress: req.ip || 'unknown',
        details: { entity, timestamp: new Date() },
      }
    });

    const data = await fetcher();
    res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('[API] Backup error:', error);
    res.status(500).json({ success: false, error: 'Backup failed: ' + error.message });
  }
});

// POST Mark Notification as Read (Student webhook / Admin manual)
router.post('/admin/dev/notifications/:id/mark-read', verifyToken, async (req, res) => {
  try {
    const id  = parseInt(req.params.id);
    const { readAt, deliveredAt } = req.body;
    const updated = await prisma.notificationLog.update({
      where: { id },
      data: {
        readAt:      readAt      ? new Date(readAt)      : (new Date()),
        deliveredAt: deliveredAt ? new Date(deliveredAt) : undefined,
      }
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[API] Mark notification read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notification' });
  }
});

// GET Device Stats (OS & Browser breakdown + latest device logins)
router.get('/admin/dev/device-stats', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' });
    }

    const osGroup = await prisma.sessionLog.groupBy({
      by: ['deviceOs'],
      _count: { _all: true },
      where: { status: 'SUCCESS' }
    });

    const browserGroup = await prisma.sessionLog.groupBy({
      by: ['browser'],
      _count: { _all: true },
      where: { status: 'SUCCESS' }
    });

    const latestSessions = await prisma.sessionLog.findMany({
      take: 20,
      orderBy: { loginTime: 'desc' },
      select: {
        id: true,
        userEmail: true,
        role: true,
        loginTime: true,
        ipAddress: true,
        deviceOs: true,
        browser: true,
        appVersion: true,
        devicePlatform: true
      }
    });

    res.json({
      success: true,
      data: {
        os: osGroup.map(g => ({ name: g.deviceOs || 'Web/Desktop', count: g._count._all })),
        browser: browserGroup.map(g => ({ name: g.browser || 'Unknown', count: g._count._all })),
        sessions: latestSessions
      }
    });
  } catch (error) {
    console.error('[API] Device stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch device stats' });
  }
});

// POST Execute SQL query (SELECT/WITH READ-ONLY Terminal)
router.post('/admin/dev/sql-query', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' });
    }
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: 'SQL query content is required' });
    }

    const sql = query.trim();

    // Read-only whitelist check
    if (!/^(select|with)\s/i.test(sql)) {
      return res.status(400).json({ success: false, error: 'SQL terminal is strictly READ-ONLY. Only SELECT or WITH queries are permitted.' });
    }

    // Blacklist dangerous actions
    if (/\b(update|delete|drop|alter|truncate|insert|create|grant|revoke)\b/i.test(sql)) {
      return res.status(400).json({ success: false, error: 'Dangerous keyword detected. Only READ-ONLY operations are allowed.' });
    }

    // Guard against EXPLAIN queries (can be used for heavy analysis / info disclosure)
    if (/^\s*explain\b/i.test(sql)) {
      return res.status(400).json({ success: false, error: 'EXPLAIN queries are not permitted in read-only terminal.' });
    }

    // Guard against deeply nested CTEs that can exhaust server memory
    const cteDepth = (sql.match(/\bWITH\b/gi) || []).length;
    if (cteDepth > 3) {
      return res.status(400).json({ success: false, error: 'Query complexity limit exceeded. Maximum 3 CTE (WITH) levels allowed.' });
    }

    // Log in audit log
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    await prisma.auditLog.create({
      data: {
        action: 'SQL_EXECUTE',
        entityType: 'DATABASE',
        entityId: null,
        userEmail: req.user.email,
        ipAddress: clientIp,
        details: { query: sql }
      }
    });

    const resultPromise = prisma.$queryRawUnsafe(sql);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Query execution timeout (10s)')), 10000));

    const result = await Promise.race([resultPromise, timeoutPromise]);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[API] SQL execute error:', error);
    res.status(500).json({ success: false, error: 'SQL execution failed: ' + error.message });
  }
});

// GET AI Operational Insights
router.get('/admin/dev/ai-insights', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' });
    }

    const insights = await prisma.insightLog.findMany({
      take: 12,
      orderBy: { generatedAt: 'desc' }
    });

    res.json({ success: true, data: insights });
  } catch (error) {
    console.error('[API] Fetch AI insights error:', error);
    res.status(500).json({ success: false, error: 'Failed to load operational insights' });
  }
});

// POST Trigger AI Insights Generation
router.post('/admin/dev/ai-insights/generate', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' });
    }

    const { generateOperationalInsights } = require('../services/aiInsights');
    const insights = await generateOperationalInsights();

    res.json({ success: true, message: 'AI insights generated and stored successfully.', data: insights });
  } catch (error) {
    console.error('[API] Trigger AI insights generation error:', error);
    res.status(500).json({ success: false, error: 'AI Insights generation failed: ' + error.message });
  }
});

// GET Real-time System Vitals (Node.js process metrics)
router.get('/admin/dev/system-vitals', verifyToken, isSuperAdmin, (req, res) => {
  try {
    const mem    = process.memoryUsage();
    const uptime = Math.floor(process.uptime());
    const hours  = Math.floor(uptime / 3600);
    const mins   = Math.floor((uptime % 3600) / 60);
    const secs   = uptime % 60;

    res.json({
      success: true,
      data: {
        nodeVersion:    process.version,
        platform:       process.platform,
        arch:           process.arch,
        env:            process.env.NODE_ENV || 'development',
        uptimeSeconds:  uptime,
        uptimeFormatted: `${hours}h ${mins}m ${secs}s`,
        memHeapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
        memHeapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        memRssMB:       Math.round(mem.rss       / 1024 / 1024),
        memExternalMB:  Math.round(mem.external  / 1024 / 1024),
        jwtAlgorithm:   'HMAC-SHA256 (HS256)',
        passwordHash:   'bcrypt (cost=10)',
        transport:      'TLS 1.3 / HTTPS',
        sessionExpiry:  '90d (JWT) / 24h (Impersonate)',
        pid:            process.pid,
      }
    });
  } catch (error) {
    console.error('[API] System vitals error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve system vitals' });
  }
});

// GET Live API Requests Stream (SSE)
router.get('/admin/dev/request-stream', verifyToken, (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' });
  }
  const { registerAdminSse } = require('../middleware/requestLogger');
  registerAdminSse(req, res);
});

// GET Recent API Requests (Static log cache)
router.get('/admin/dev/recent-requests', verifyToken, (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' });
  }
  const { getRecentRequests } = require('../middleware/requestLogger');
  res.json({ success: true, data: getRecentRequests() });
});

// ==========================================
// AI SELF-HEALING PATCHER ENDPOINTS
// ==========================================
const patcherService = require('../services/patcherService');

// GET all patches
router.get('/admin/dev/patches', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const patches = patcherService.getPatches();
    res.status(200).json({ success: true, data: patches });
  } catch (error) {
    console.error('[API] Get patches error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve patches: ' + error.message });
  }
});

// POST Approve & Merge Patch
router.post('/admin/dev/patches/:id/approve', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { id } = req.params;
    const patch = patcherService.approvePatch(id);
    
    // Log the approval action
    await prisma.auditLog.create({
      data: {
        action: 'APPROVE_PATCH',
        entityType: 'FILE',
        entityId: null,
        userEmail: req.user.email,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        details: { patchId: id, filePath: patch.filePath, resolvedAt: patch.resolvedAt }
      }
    });

    res.status(200).json({ success: true, message: 'Patch approved and applied successfully', data: patch });
  } catch (error) {
    console.error('[API] Approve patch error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve patch: ' + error.message });
  }
});

// POST Dismiss Patch
router.post('/admin/dev/patches/:id/dismiss', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { id } = req.params;
    const patch = patcherService.dismissPatch(id);
    
    // Log the dismiss action
    await prisma.auditLog.create({
      data: {
        action: 'DISMISS_PATCH',
        entityType: 'FILE',
        entityId: null,
        userEmail: req.user.email,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        details: { patchId: id, filePath: patch.filePath }
      }
    });

    res.status(200).json({ success: true, message: 'Patch dismissed successfully', data: patch });
  } catch (error) {
    console.error('[API] Dismiss patch error:', error);
    res.status(500).json({ success: false, error: 'Failed to dismiss patch: ' + error.message });
  }
});

// POST Trigger test server error
router.post('/admin/dev/patches/trigger-test-error', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    // Throw an error explicitly to test
    throw new Error('TEST_ERROR: Simulating a critical 500 error to verify AI self-healing patch generation.');
  } catch (error) {
    console.error('[API] Trigger test error endpoint catch:', error.message);
    throw error;
  }
});

// ── FIREWALL MANAGEMENT ENDPOINTS ──

// GET all blocked IPs
router.get('/admin/dev/firewall/blocked', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const list = await prisma.blockedIP.findMany({ orderBy: { blockedAt: 'desc' } });
    res.status(200).json({ success: true, data: list });
  } catch (error) {
    console.error('[API] Fetch blocked IPs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch firewall logs' });
  }
});

// POST block an IP
router.post('/admin/dev/firewall/block', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { ip, reason } = req.body;
    if (!ip) {
      return res.status(400).json({ success: false, error: 'IP address is required' });
    }

    const cleanIp = ip.trim();
    // Save to DB
    const entry = await prisma.blockedIP.upsert({
      where: { ip: cleanIp },
      update: { reason },
      create: { ip: cleanIp, reason }
    });

    // Update in-memory cache
    const { addBlockedIpToCache } = require('../middleware/firewall');
    addBlockedIpToCache(cleanIp);

    // Audit log
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    await prisma.auditLog.create({
      data: {
        action: 'BLOCK_IP',
        entityType: 'BlockedIP',
        entityId: entry.id,
        userEmail: req.user.email,
        ipAddress: clientIp,
        details: { blockedIp: cleanIp, reason }
      }
    });

    res.status(200).json({ success: true, message: `IP ${cleanIp} has been blocked.`, data: entry });
  } catch (error) {
    console.error('[API] Block IP error:', error);
    res.status(500).json({ success: false, error: 'Failed to block IP' });
  }
});

// POST unblock an IP
router.post('/admin/dev/firewall/unblock', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const { ip } = req.body;
    if (!ip) {
      return res.status(400).json({ success: false, error: 'IP address is required' });
    }

    const cleanIp = ip.trim();
    // Delete from DB
    await prisma.blockedIP.deleteMany({ where: { ip: cleanIp } });

    // Update cache
    const { removeBlockedIpFromCache } = require('../middleware/firewall');
    removeBlockedIpFromCache(cleanIp);

    // Audit log
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    await prisma.auditLog.create({
      data: {
        action: 'UNBLOCK_IP',
        entityType: 'BlockedIP',
        entityId: null,
        userEmail: req.user.email,
        ipAddress: clientIp,
        details: { unblockedIp: cleanIp }
      }
    });

    res.status(200).json({ success: true, message: `IP ${cleanIp} has been unblocked.` });
  } catch (error) {
    console.error('[API] Unblock IP error:', error);
    res.status(500).json({ success: false, error: 'Failed to unblock IP' });
  }
});

// ── TIME TRAVEL / ROLLBACK ENGINE ──

// POST Rollback change via AuditLog ID
router.post('/admin/dev/audit-logs/rollback/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Requires SUPER_ADMIN privileges' });
    }
    const auditLogId = parseInt(req.params.id);
    const log = await prisma.auditLog.findUnique({ where: { id: auditLogId } });
    if (!log) {
      return res.status(404).json({ success: false, error: 'Audit log not found' });
    }

    const { action, entityType, entityId, details } = log;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    // Verify entityType is supported
    const supportedTypes = ['Schedule', 'Room', 'Lecturer', 'Subject', 'Student', 'Group', 'VerificationCode'];
    if (!supportedTypes.includes(entityType)) {
      return res.status(400).json({ success: false, error: `Rollback not supported for entity type: ${entityType}` });
    }

    const modelName = entityType.charAt(0).toLowerCase() + entityType.slice(1);

    if (action.startsWith('CREATE_') || action === 'CREATE') {
      // Rollback CREATE -> DELETE
      if (entityId) {
        await prisma[modelName].delete({ where: { id: entityId } });
      }
    } else if (action.startsWith('UPDATE_') || action === 'UPDATE') {
      // Rollback UPDATE -> Restore previous values
      const prevState = details?.previousState || details?.oldValues || details?.before || details;
      if (entityId && prevState && Object.keys(prevState).length > 0) {
        const dataToRestore = { ...prevState };
        delete dataToRestore.id;
        delete dataToRestore.createdAt;
        delete dataToRestore.updatedAt;

        await prisma[modelName].update({
          where: { id: entityId },
          data: dataToRestore
        });
      } else {
        return res.status(400).json({ success: false, error: 'Cannot rollback UPDATE: previous state missing in audit log details' });
      }
    } else if (action.startsWith('DELETE_') || action === 'DELETE') {
      // Rollback DELETE -> Recreate
      const deletedState = details?.deletedState || details?.oldValues || details?.before || details;
      if (deletedState && Object.keys(deletedState).length > 0) {
        const dataToRestore = { ...deletedState };
        await prisma[modelName].create({
          data: dataToRestore
        });
      } else {
        return res.status(400).json({ success: false, error: 'Cannot rollback DELETE: deleted state missing in audit log details' });
      }
    } else {
      return res.status(400).json({ success: false, error: `Unsupported rollback action type: ${action}` });
    }

    // Log the rollback action itself to the AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'ROLLBACK_ACTION',
        entityType: 'AuditLog',
        entityId: auditLogId,
        userEmail: req.user.email,
        ipAddress: clientIp,
        details: { rolledBackAction: action, rolledBackEntity: entityType, rolledBackId: entityId }
      }
    });

    res.status(200).json({
      success: true,
      message: `Successfully rolled back action ${action} on ${entityType} (ID: ${entityId}).`
    });
  } catch (error) {
    console.error('[API] Rollback error:', error);
    res.status(500).json({ success: false, error: 'Rollback execution failed: ' + error.message });
  }
});

// ── MASTER DATA MANAGER EXTRA ADMIN ENDPOINTS (STUDENTS, ROOMS, MAJORS) ──

// 1. GET /api/admin/students - Get all students (scoped)
router.get('/admin/students', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { role, collegeId, universityId } = req.user;
    const { page, limit, searchQuery } = req.query;
    let whereClause = {};

    if (role === 'COLLEGE_ADMIN') {
      whereClause.collegeId = parseInt(collegeId);
    } else if (role === 'UNI_ADMIN') {
      whereClause.college = { universityId: parseInt(universityId) };
    } else if (role === 'SUPER_ADMIN') {
      const qCollegeId = req.query.collegeId;
      if (qCollegeId) {
        whereClause.collegeId = parseInt(qCollegeId);
      }
    }

    if (searchQuery) {
      whereClause.OR = [
        { name: { contains: searchQuery, mode: 'insensitive' } },
        { email: { contains: searchQuery, mode: 'insensitive' } },
        { idNumber: { contains: searchQuery, mode: 'insensitive' } }
      ];
    }

    if (page && limit) {
      const p = parseInt(page) || 1;
      const l = parseInt(limit) || 15;
      const skip = (p - 1) * l;

      const [students, totalCount] = await Promise.all([
        prisma.student.findMany({
          where: whereClause,
          include: {
            college: true,
            major: true,
            group: true,
            level: true
          },
          orderBy: { name: 'asc' },
          skip,
          take: l
        }),
        prisma.student.count({ where: whereClause })
      ]);

      return res.status(200).json({
        success: true,
        data: students,
        totalCount,
        hasMore: skip + students.length < totalCount
      });
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        college: true,
        major: true,
        group: true,
        level: true
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    console.error('[API] Get admin students error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch students: ' + error.message });
  }
});

// 2. POST /api/admin/students - Create or Update a student
router.post('/admin/students', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id, name, email, academicId, majorId, levelId, collegeId, groupId, password } = req.body;

    let targetCollegeId = collegeId ? parseInt(collegeId) : undefined;
    if (req.user.role !== 'SUPER_ADMIN') {
      targetCollegeId = req.user.collegeId;
    }

    let student;
    if (id) {
      student = await prisma.student.update({
        where: { id: parseInt(id) },
        data: {
          name,
          email,
          idNumber: academicId,
          majorId: majorId ? parseInt(majorId) : null,
          levelId: levelId ? parseInt(levelId) : null,
          groupId: groupId ? parseInt(groupId) : null,
          collegeId: targetCollegeId
        }
      });
    } else {
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password || '12345678', salt);

      student = await prisma.student.create({
        data: {
          name,
          email,
          idNumber: academicId,
          password: hashedPassword,
          majorId: majorId ? parseInt(majorId) : null,
          levelId: levelId ? parseInt(levelId) : null,
          groupId: groupId ? parseInt(groupId) : null,
          collegeId: targetCollegeId,
          isEmailVerified: true
        }
      });
    }

    res.status(200).json({ success: true, data: student });
  } catch (error) {
    console.error('[API] Save admin student error:', error);
    res.status(500).json({ success: false, error: 'Failed to save student: ' + error.message });
  }
});

// 3. DELETE /api/admin/students/:id - Delete a student
router.delete('/admin/students/:id', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const studentId = parseInt(req.params.id);
    await prisma.student.delete({
      where: { id: studentId }
    });
    res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    console.error('[API] Delete admin student error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete student: ' + error.message });
  }
});

// 3.5 GET /api/admin/colleges - Get all colleges (scoped)
router.get('/admin/colleges', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { role, collegeId, universityId } = req.user;
    let whereClause = {};

    if (role === 'COLLEGE_ADMIN') {
      whereClause.id = parseInt(collegeId);
    } else if (role === 'UNI_ADMIN') {
      whereClause.universityId = parseInt(universityId);
    } else if (role === 'SUPER_ADMIN') {
      const qUniversityId = req.query.universityId;
      if (qUniversityId) {
        whereClause.universityId = parseInt(qUniversityId);
      }
    }

    const colleges = await prisma.college.findMany({
      where: whereClause,
      include: { university: true },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: colleges });
  } catch (error) {
    console.error('[API] Get admin colleges error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch colleges: ' + error.message });
  }
});

// 4. GET /api/admin/rooms - Get all rooms
router.get('/admin/rooms', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { role, collegeId, universityId } = req.user;
    let whereClause = {};

    if (role === 'COLLEGE_ADMIN') {
      whereClause.collegeId = parseInt(collegeId);
    } else if (role === 'UNI_ADMIN') {
      whereClause.college = { universityId: parseInt(universityId) };
    } else if (role === 'SUPER_ADMIN') {
      const qCollegeId = req.query.collegeId;
      if (qCollegeId) {
        whereClause.collegeId = parseInt(qCollegeId);
      }
    }

    const rooms = await prisma.room.findMany({
      where: whereClause,
      include: { college: true },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: rooms });
  } catch (error) {
    console.error('[API] Get admin rooms error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch rooms: ' + error.message });
  }
});

// 5. POST /api/admin/rooms - Create or Update a room
router.post('/admin/rooms', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id, name, capacity, collegeId } = req.body;

    let targetCollegeId = collegeId ? parseInt(collegeId) : undefined;
    if (req.user.role !== 'SUPER_ADMIN') {
      targetCollegeId = req.user.collegeId;
    }

    let room;
    if (id) {
      room = await prisma.room.update({
        where: { id: parseInt(id) },
        data: {
          name,
          capacity: parseInt(capacity)
        }
      });
    } else {
      room = await prisma.room.create({
        data: {
          name,
          capacity: parseInt(capacity),
          collegeId: targetCollegeId
        }
      });
    }

    res.status(200).json({ success: true, data: room });
  } catch (error) {
    console.error('[API] Save admin room error:', error);
    res.status(500).json({ success: false, error: 'Failed to save room: ' + error.message });
  }
});

// 6. DELETE /api/admin/rooms/:id - Delete a room
router.delete('/admin/rooms/:id', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const roomId = parseInt(req.params.id);
    await prisma.room.delete({
      where: { id: roomId }
    });
    res.status(200).json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    console.error('[API] Delete admin room error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete room: ' + error.message });
  }
});

// 7. GET /api/admin/majors - Get all majors
router.get('/admin/majors', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { role, collegeId, universityId } = req.user;
    let whereClause = {};

    if (role === 'COLLEGE_ADMIN') {
      whereClause.department = { collegeId: parseInt(collegeId) };
    } else if (role === 'UNI_ADMIN') {
      whereClause.department = { college: { universityId: parseInt(universityId) } };
    } else if (role === 'SUPER_ADMIN') {
      const qCollegeId = req.query.collegeId;
      if (qCollegeId) {
        whereClause.department = { collegeId: parseInt(qCollegeId) };
      }
    }

    const majors = await prisma.major.findMany({
      where: whereClause,
      include: {
        department: {
          include: { college: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    const formatted = majors.map(m => ({
      ...m,
      college: m.department?.college,
      collegeId: m.department?.collegeId
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('[API] Get admin majors error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch majors: ' + error.message });
  }
});

// 8. POST /api/admin/majors - Create or Update a major
router.post('/admin/majors', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id, name, code, collegeId } = req.body;

    let targetCollegeId = collegeId ? parseInt(collegeId) : undefined;
    if (req.user.role !== 'SUPER_ADMIN') {
      targetCollegeId = req.user.collegeId;
    }

    let dept = await prisma.department.findFirst({
      where: { collegeId: targetCollegeId }
    });
    if (!dept) {
      dept = await prisma.department.create({
        data: { name: 'القسم العام', collegeId: targetCollegeId }
      });
    }

    let major;
    if (id) {
      major = await prisma.major.update({
        where: { id: parseInt(id) },
        data: {
          name,
          code,
          departmentId: dept.id
        }
      });
    } else {
      major = await prisma.major.create({
        data: {
          name,
          code,
          departmentId: dept.id
        }
      });
    }

    res.status(200).json({ success: true, data: major });
  } catch (error) {
    console.error('[API] Save admin major error:', error);
    res.status(500).json({ success: false, error: 'Failed to save major: ' + error.message });
  }
});

// 9. DELETE /api/admin/majors/:id - Delete a major
router.delete('/admin/majors/:id', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const majorId = parseInt(req.params.id);
    await prisma.major.delete({
      where: { id: majorId }
    });
    res.status(200).json({ success: true, message: 'Major deleted successfully' });
  } catch (error) {
    console.error('[API] Delete admin major error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete major: ' + error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// NEW DEV API: Dynamic Database Injection & Licensing Console
// ─────────────────────────────────────────────────────────────
const devPortalController = require('../controllers/devPortalController');

router.post('/admin/dev/generate-tenant-key', verifyToken, isSuperAdmin, async (req, res) => {
  return devPortalController.generateTenantKey(req, res);
});

router.post('/admin/dev/inject-db-string', verifyToken, isSuperAdmin, async (req, res) => {
  return devPortalController.injectAndValidateDB(req, res);
});

router.post('/admin/dev/toggle-tenant-license', verifyToken, isSuperAdmin, async (req, res) => {
  return devPortalController.toggleLicenseAndKillSessions(req, res);
});

// GET /api/admin/dev/tenant-configs — Fetch all universities + colleges with their TenantConfig nodes
router.get('/admin/dev/tenant-configs', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const [universities, colleges] = await Promise.all([
      prisma.university.findMany({
        include: {
          tenantConfig: true,
          colleges: { select: { id: true, name: true, slug: true } }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.college.findMany({
        include: {
          tenantConfig: true,
          university: { select: { id: true, name: true } }
        },
        orderBy: { name: 'asc' }
      })
    ]);

    res.json({ success: true, data: { universities, colleges } });
  } catch (error) {
    console.error('[DevPortal] Fetch tenant configs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tenant configurations: ' + error.message });
  }
});

// PATCH /api/admin/dev/tenant-configs/universities/:id — Update university branding
router.post('/admin/dev/tenant-configs/universities/:id', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, slug, themeColor, logoUrl, enforceSSL, allowedDomains } = req.body;
    const university = await prisma.university.update({
      where: { id },
      data: { name, slug, themeColor, logoUrl }
    });
    // Upsert TenantConfig for university
    await prisma.tenantConfig.upsert({
      where: { universityId: id },
      update: { enabledFeatures: { enforceSSL: !!enforceSSL, allowedDomains: allowedDomains || [] } },
      create: { universityId: id, enabledFeatures: { enforceSSL: !!enforceSSL, allowedDomains: allowedDomains || [] } }
    });
    res.json({ success: true, data: university });
  } catch (error) {
    console.error('[DevPortal] Update university config error:', error);
    res.status(500).json({ success: false, error: 'Failed to update university: ' + error.message });
  }
});

// PATCH /api/admin/dev/tenant-configs/colleges/:id — Update college branding
router.post('/admin/dev/tenant-configs/colleges/:id', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, slug, themeColor, logoUrl, enforceSSL, allowedDomains } = req.body;
    const college = await prisma.college.update({
      where: { id },
      data: { name, slug, themeColor, logoUrl }
    });
    // Upsert TenantConfig for college
    await prisma.tenantConfig.upsert({
      where: { collegeId: id },
      update: { enabledFeatures: { enforceSSL: !!enforceSSL, allowedDomains: allowedDomains || [] } },
      create: { collegeId: id, enabledFeatures: { enforceSSL: !!enforceSSL, allowedDomains: allowedDomains || [] } }
    });
    res.json({ success: true, data: college });
  } catch (error) {
    console.error('[DevPortal] Update college config error:', error);
    res.status(500).json({ success: false, error: 'Failed to update college: ' + error.message });
  }
});

module.exports = router;




