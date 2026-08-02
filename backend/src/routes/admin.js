const express = require('express');
const bcrypt = require('bcryptjs');
const xlsx = require('xlsx');
const { prisma } = require('../db');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { broadcastSSE, sendPushNotification } = require('../services/notifications');

const excelParserService = require('../services/excelParserService');
const scheduleService = require('../services/scheduleService');

const router = express.Router();

function isAuthorizedAdmin(req) {
  return req.user && req.user.role === 'ADMIN';
}

// 1. GET Admin Metrics
router.get('/admin/metrics', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const students = await prisma.student.count();
    const schedules = await prisma.schedule.count();
    const departments = await prisma.department.count();
    const rooms = await prisma.room.count();

    res.status(200).json({
      success: true,
      data: { students, lectures: schedules, departments, classrooms: rooms }
    });
  } catch (error) {
    console.error('[API] Error fetching metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch metrics' });
  }
});

// 2. GET Analytics
router.get('/admin/analytics', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const totalStudents = await prisma.student.count();
    const totalGroups = await prisma.group.count();
    const totalSchedules = await prisma.schedule.count();

    const attendances = await prisma.attendanceRecord.findMany({
      take: 1000,
      orderBy: { scannedAt: 'desc' }
    });

    const totalAttendanceLogs = attendances.length;
    const presentLogs = attendances.filter(a => a.status === 'PRESENT').length;
    const attendanceHealth = totalAttendanceLogs > 0 ? Math.round((presentLogs / totalAttendanceLogs) * 100) : 100;

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        totalGroups,
        totalSchedules,
        attendanceHealth,
        totalAttendanceLogs,
        presentLogs
      }
    });
  } catch (error) {
    console.error('[API] Error fetching analytics:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

// 3. GET all unverified students
router.get('/admin/unverified-students', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const students = await prisma.student.findMany({
      where: {
        OR: [
          { isEmailVerified: false },
          { isPhoneVerified: false }
        ]
      },
      include: {
        major: { include: { department: true } },
        level: true,
        group: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    console.error('[API] Error fetching unverified students:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unverified students' });
  }
});

// 4. Approve student
router.post('/admin/students/:id/approve', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const studentId = parseInt(req.params.id);

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

// 5. Reject student
router.post('/admin/students/:id/reject', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const studentId = parseInt(req.params.id);

    await prisma.student.delete({
      where: { id: studentId }
    });

    res.status(200).json({ success: true, message: 'Student successfully rejected and deleted.' });
  } catch (error) {
    console.error('[API] Error rejecting student:', error);
    res.status(500).json({ success: false, error: 'Failed to reject student' });
  }
});

// 6. GET all students
router.get('/students', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { page, limit, searchQuery, majorId, levelId, groupId, showUnverifiedOnly } = req.query;
    let whereClause = {};

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

// 7. Toggle Representative Status
router.put('/admin/students/:id/representative-status', verifyToken, requirePermission('STUDENT.TOGGLE_REP'), async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const studentId = parseInt(req.params.id);
    const { isRepresentative } = req.body;

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

// 8. Manage Lecturers - Create
router.post('/admin/lecturers', verifyToken, requirePermission('LECTURER.MANAGE'), async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { name, email, password, phone } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
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
        phone
      }
    });

    const { password: _, ...safeLecturer } = lecturer;
    res.status(201).json({ success: true, data: safeLecturer });
  } catch (error) {
    console.error('[API] Create lecturer error:', error);
    res.status(500).json({ success: false, error: 'Failed to create lecturer' });
  }
});

// 9. Manage Lecturers - Get All
router.get('/admin/lecturers', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const lecturers = await prisma.lecturer.findMany({
      include: {
        schedules: {
          include: { subject: true, group: true }
        }
      },
      orderBy: { name: 'asc' }
    });

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

// 10. Manage Lecturers - Update
router.put('/admin/lecturers/:id', verifyToken, requirePermission('LECTURER.MANAGE'), async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    
    const lecturerId = parseInt(req.params.id);
    const { name, email, password, phone } = req.body;

    const lecturer = await prisma.lecturer.findUnique({ where: { id: lecturerId } });
    if (!lecturer) {
      return res.status(404).json({ success: false, error: 'Lecturer not found' });
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

// 11. Schedule Overrides
router.post('/schedules/override', verifyToken, requirePermission('SCHEDULE.EDIT'), async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Only administrators can modify schedules' });
    }

    const { scheduleId, newStartTime, newEndTime, newRoomId, date, overrideType } = req.body;

    const override = await scheduleService.createOverride(
      scheduleId,
      newStartTime,
      newEndTime,
      newRoomId,
      date,
      overrideType,
      {}
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

// 12. Create Base Schedule
router.post('/schedules', verifyToken, requirePermission('SCHEDULE.CREATE'), async (req, res) => {
  try {
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
      lecturerId: bodyLecturerId
    } = req.body;

    if (!subjectName || !subjectCode || !subjectType || !roomName || !lecturerName || !groupName || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'Missing required schedule fields' });
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

    const subject = await prisma.subject.upsert({
      where: { code: subjectCode },
      update: { name: subjectName, type: upperSubjectType },
      create: { name: subjectName, code: subjectCode, type: upperSubjectType }
    });

    const room = await prisma.room.upsert({
      where: { name: roomName },
      update: { capacity: parseInt(roomCapacity) || 45 },
      create: { name: roomName, capacity: parseInt(roomCapacity) || 45 }
    });

    let group = await prisma.group.findFirst({
      where: { name: groupName }
    });
    if (!group) {
      group = await prisma.group.create({
        data: { name: groupName }
      });
    }

    let lecturerId = bodyLecturerId ? parseInt(bodyLecturerId) : null;
    if (!lecturerId) {
      const lecturer = await prisma.lecturer.findFirst({
        where: { name: lecturerName }
      });
      if (lecturer) {
        lecturerId = lecturer.id;
      }
    }

    const clash = await prisma.schedule.findFirst({
      where: {
        dayOfWeek: upperDayOfWeek,
        startTime,
        subjectId: { not: subject.id },
        OR: [{ roomId: room.id }, lecturerId ? { lecturerId } : { lecturerName }]
      }
    });
    if (clash) {
      return res.status(409).json({ success: false, error: 'Conflict: Room or Lecturer already assigned to another class during this time slot.' });
    }

    const newSchedule = await prisma.schedule.create({
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
        group: true,
        overrides: true
      }
    });

    broadcastSSE('SCHEDULE_UPDATE', { scheduleId: newSchedule.id });
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

// 13. Update Base Schedule
router.put('/schedules/:id', verifyToken, requirePermission('SCHEDULE.EDIT'), async (req, res) => {
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
      lecturerId: bodyLecturerId
    } = req.body;

    const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    const upperSubjectType = subjectType.toUpperCase();
    const upperDayOfWeek = dayOfWeek.toUpperCase();

    const subject = await prisma.subject.upsert({
      where: { code: subjectCode },
      update: { name: subjectName, type: upperSubjectType },
      create: { name: subjectName, code: subjectCode, type: upperSubjectType }
    });

    const room = await prisma.room.upsert({
      where: { name: roomName },
      update: { capacity: parseInt(roomCapacity) || 45 },
      create: { name: roomName, capacity: parseInt(roomCapacity) || 45 }
    });

    let group = await prisma.group.findFirst({ where: { name: groupName } });
    if (!group) {
      group = await prisma.group.create({ data: { name: groupName } });
    }

    let lecturerId = bodyLecturerId ? parseInt(bodyLecturerId) : null;
    if (!lecturerId) {
      const lecturer = await prisma.lecturer.findFirst({ where: { name: lecturerName } });
      if (lecturer) lecturerId = lecturer.id;
    }

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
      include: { subject: true, room: true, group: true }
    });

    broadcastSSE('SCHEDULE_UPDATE', { scheduleId: updatedSchedule.id });
    res.status(200).json({ success: true, message: 'Schedule updated successfully.', data: updatedSchedule });
  } catch (error) {
    console.error('[API] Error updating schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to update schedule' });
  }
});

// 14. Delete Schedule
router.delete('/schedules/:id', verifyToken, requirePermission('SCHEDULE.DELETE'), async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const scheduleId = parseInt(req.params.id);
    await prisma.scheduleOverride.deleteMany({ where: { scheduleId } });
    await prisma.rescheduleRequest.deleteMany({ where: { scheduleId } });
    await prisma.schedule.delete({ where: { id: scheduleId } });

    broadcastSSE('SCHEDULE_UPDATE', { scheduleId });
    res.status(200).json({ success: true, message: 'Schedule deleted successfully.' });
  } catch (error) {
    console.error('[API] Error deleting schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to delete schedule' });
  }
});

// 15. Manage Groups - Post & Delete
router.post('/groups', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id, name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Group name is required' });

    let group;
    if (id) {
      group = await prisma.group.update({ where: { id: parseInt(id) }, data: { name } });
    } else {
      group = await prisma.group.create({ data: { name } });
    }
    res.status(201).json({ success: true, data: group });
  } catch (error) {
    console.error('[API] Error saving group:', error);
    res.status(500).json({ success: false, error: 'Failed to save group' });
  }
});

router.delete('/groups/:id', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id } = req.params;
    await prisma.group.delete({ where: { id: parseInt(id) } });
    res.status(200).json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    console.error('[API] Error deleting group:', error);
    res.status(500).json({ success: false, error: 'Failed to delete group' });
  }
});

// 16. Manage Rooms - Post & Delete
router.post('/rooms', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id, name, capacity } = req.body;
    if (!name || !capacity) return res.status(400).json({ success: false, error: 'Room name and capacity are required' });

    let room;
    if (id) {
      room = await prisma.room.update({ where: { id: parseInt(id) }, data: { name, capacity: parseInt(capacity) } });
    } else {
      room = await prisma.room.create({ data: { name, capacity: parseInt(capacity) } });
    }
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    console.error('[API] Error saving room:', error);
    res.status(500).json({ success: false, error: 'Failed to save room' });
  }
});

router.delete('/rooms/:id', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { id } = req.params;
    await prisma.room.delete({ where: { id: parseInt(id) } });
    res.status(200).json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    console.error('[API] Error deleting room:', error);
    res.status(500).json({ success: false, error: 'Failed to delete room' });
  }
});

// 17. Broadcast Announcement
router.post('/broadcasts', verifyToken, requirePermission('BROADCAST.SEND'), async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { groupId, message } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });

    const parsedGroupId = groupId === 'ALL' || !groupId ? null : parseInt(groupId);

    const log = await prisma.notificationLog.create({
      data: {
        groupId: parsedGroupId,
        message,
        status: 'SENT'
      }
    });

    broadcastSSE('BROADCAST_MESSAGE', { groupId: parsedGroupId, message });
    sendPushNotification(parsedGroupId, {
      title: 'تنبيه من كلية المنار الجامعية',
      body: message,
      url: '/student/home'
    });

    res.status(201).json({ success: true, data: log });
  } catch (error) {
    console.error('[API] Error creating broadcast:', error);
    res.status(500).json({ success: false, error: 'Failed to create broadcast' });
  }
});

// 18. Admin Logs
router.get('/admin/logs', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const logs = await prisma.notificationLog.findMany({
      include: { group: true },
      orderBy: { sentTime: 'desc' }
    });
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error('[API] Error fetching logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
});

router.delete('/admin/logs', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    await prisma.notificationLog.deleteMany({});
    res.status(200).json({ success: true, message: 'All logs cleared successfully' });
  } catch (error) {
    console.error('[API] Error clearing logs:', error);
    res.status(500).json({ success: false, error: 'Failed to clear logs' });
  }
});

// 19. Reschedule Requests
router.get('/admin/requests', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const requests = await prisma.rescheduleRequest.findMany({
      include: {
        lecturer: true,
        schedule: { include: { subject: true, room: true, group: true } },
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

router.post('/admin/requests/:id/resolve', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const requestId = parseInt(req.params.id);
    const { status, overrideType, date, adminNotes } = req.body;

    const request = await prisma.rescheduleRequest.findUnique({
      where: { id: requestId },
      include: { schedule: { include: { subject: true, group: true, room: true } }, lecturer: true }
    });

    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ success: false, error: 'Request already resolved' });

    if (status === 'APPROVED') {
      const isReschedule = request.requestType === 'RESCHEDULE';
      const resolvedOverrideType = overrideType || 'TEMPORARY';

      if (resolvedOverrideType === 'TEMPORARY') {
        await prisma.scheduleOverride.create({
          data: {
            scheduleId: request.scheduleId,
            newStartTime: isReschedule ? request.newStartTime : null,
            newEndTime: isReschedule ? request.newEndTime : null,
            newRoomId: isReschedule ? request.newRoomId : null,
            date: date ? new Date(date) : new Date(),
            overrideType: 'TEMPORARY'
          }
        });
      } else {
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
    }

    const updatedRequest = await prisma.rescheduleRequest.update({
      where: { id: requestId },
      data: { status, adminNotes }
    });

    res.status(200).json({ success: true, data: updatedRequest });
  } catch (error) {
    console.error('[API] Error resolving request:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve request' });
  }
});

// 20. Excel Bulk Upload Endpoints
router.post('/admin/upload-students', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) return res.status(403).json({ success: false, error: 'Forbidden' });
    const { fileBase64 } = req.body;
    if (!fileBase64) return res.status(400).json({ success: false, error: 'fileBase64 is required' });

    const results = await excelParserService.uploadStudents(fileBase64);
    res.status(200).json({ success: true, message: `Bulk upload complete: ${results.created} created, ${results.skipped} skipped`, data: results });
  } catch (error) {
    console.error('[API] upload-students error:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to process student upload' });
  }
});

router.post('/admin/upload-schedules', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) return res.status(403).json({ success: false, error: 'Forbidden' });
    const { fileBase64 } = req.body;
    if (!fileBase64) return res.status(400).json({ success: false, error: 'fileBase64 is required' });

    const results = await excelParserService.uploadSchedules(fileBase64);
    res.status(200).json({ success: true, message: `Bulk upload complete: ${results.created} created, ${results.skipped} skipped`, data: results });
  } catch (error) {
    console.error('[API] upload-schedules error:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to process schedule upload' });
  }
});

router.post('/admin/upload-exams', verifyToken, async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) return res.status(403).json({ success: false, error: 'Forbidden' });
    const { fileBase64 } = req.body;
    if (!fileBase64) return res.status(400).json({ success: false, error: 'fileBase64 is required' });

    const results = await excelParserService.uploadExams(fileBase64);
    res.status(200).json({ success: true, message: `Bulk upload complete: ${results.created} created, ${results.skipped} skipped`, data: results });
  } catch (error) {
    console.error('[API] upload-exams error:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to process exam upload' });
  }
});

module.exports = router;
