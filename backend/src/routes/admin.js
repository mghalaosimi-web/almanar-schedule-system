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


module.exports = router;
