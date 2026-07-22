const express = require('express');
const jwt = require('jsonwebtoken');
const { prisma } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { broadcastSSE, sendPushNotification, sendStudentPushNotification } = require('../services/notifications');

const router = express.Router();

// Middleware to authorize student representatives
async function isRep(req, res, next) {
  const isAdmin = ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'UNI_ADMIN'].includes(req.user?.role);
  
  if (req.user?.role !== 'STUDENT' && !isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied. Representative privileges required.' });
  }
  if (!isAdmin && !req.user?.isRepresentative) {
    return res.status(403).json({ success: false, error: 'Access denied. Representative privileges required.' });
  }
  
  // Dynamically fetch groupId from database to prevent stale token issues
  if (!req.user.groupId) {
    try {
      if (req.user.role === 'STUDENT') {
        const student = await prisma.student.findUnique({
          where: { id: req.user.id }
        });
        if (student && student.groupId) {
          req.user.groupId = student.groupId;
        } else if (student && student.collegeId) {
          // Fallback: try to find first group in student's college/major
          const fallbackGroup = await prisma.group.findFirst({
            where: {
              collegeId: student.collegeId,
              ...(student.majorId ? { majorId: student.majorId } : {})
            }
          });
          if (fallbackGroup) {
            req.user.groupId = fallbackGroup.id;
          }
        }
      }
      
      if (!req.user.groupId) {
        const globalGroup = await prisma.group.findFirst({
          where: req.user.collegeId ? { collegeId: req.user.collegeId } : {}
        });
        if (globalGroup) {
          req.user.groupId = globalGroup.id;
        }
      }
    } catch (err) {
      console.error('[isRep] Error fetching student groupId:', err);
    }
  }

  if (!req.user.groupId && !isAdmin) {
    // Return empty success structure instead of 400 Bad Request to prevent frontend toast errors
    return res.status(200).json({ success: true, data: [] });
  }
  next();
}

// 1. GET classmates in the same groupId
router.get('/classmates', verifyToken, isRep, async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      where: { groupId: req.user.groupId },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    console.error('[REP-API] Error fetching classmates:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch classmates.' });
  }
});

// 2. GET group schedules
router.get('/schedules', verifyToken, isRep, async (req, res) => {
  try {
    const schedules = await prisma.schedule.findMany({
      where: { groupId: req.user.groupId },
      include: {
        subject: true,
        room: true
      },
      orderBy: { dayOfWeek: 'asc' }
    });
    res.status(200).json({ success: true, data: schedules });
  } catch (error) {
    console.error('[REP-API] Error fetching schedules:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch schedules.' });
  }
});

// 3. GET attendance records for a specific schedule and date
router.get('/attendance', verifyToken, isRep, async (req, res) => {
  try {
    const { scheduleId, date } = req.query;
    if (!scheduleId) {
      return res.status(400).json({ success: false, error: 'Missing scheduleId parameter.' });
    }

    const schedule = await prisma.schedule.findFirst({
      where: { id: parseInt(scheduleId), groupId: req.user.groupId }
    });
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found or unauthorized.' });
    }

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const records = await prisma.attendance.findMany({
      where: {
        scheduleId: parseInt(scheduleId),
        date: targetDate,
        student: { groupId: req.user.groupId }
      }
    });

    res.status(200).json({ success: true, data: records });
  } catch (error) {
    console.error('[REP-API] Error fetching attendance records:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance history.' });
  }
});

// 4. POST save/update attendance
router.post('/attendance', verifyToken, isRep, async (req, res) => {
  try {
    const { scheduleId, date, records } = req.body; // records is an array of { studentId, status }

    if (!scheduleId || !records || !Array.isArray(records)) {
      return res.status(400).json({ success: false, error: 'Missing required attendance fields.' });
    }

    const schedule = await prisma.schedule.findFirst({
      where: { id: parseInt(scheduleId), groupId: req.user.groupId },
      include: { subject: true }
    });
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found or unauthorized.' });
    }

    // Verify all student IDs are within the rep's group
    const classmates = await prisma.student.findMany({
      where: { groupId: req.user.groupId },
      select: { id: true }
    });
    const classmateIds = classmates.map(s => s.id);
    const hasInvalidStudent = records.some(r => !classmateIds.includes(parseInt(r.studentId)));

    if (hasInvalidStudent) {
      return res.status(403).json({ success: false, error: 'Unauthorized classmate ID included in request.' });
    }

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const upsertPromises = records.map(async (record) => {
      const existing = await prisma.attendance.findFirst({
        where: {
          studentId: parseInt(record.studentId),
          scheduleId: parseInt(scheduleId),
          date: targetDate
        }
      });

      if (existing) {
        return prisma.attendance.update({
          where: { id: existing.id },
          data: { status: record.status, recordedById: req.user.id }
        });
      } else {
        return prisma.attendance.create({
          data: {
            studentId: parseInt(record.studentId),
            scheduleId: parseInt(scheduleId),
            date: targetDate,
            status: record.status,
            recordedById: req.user.id
          }
        });
      }
    });

    await Promise.all(upsertPromises);

    // Dispatch real-time student notifications
    const subjectName = schedule.subject?.name || 'محاضرة';
    for (const record of records) {
      const studentId = parseInt(record.studentId);
      const status = record.status;
      
      let statusAr = 'حاضر';
      if (status === 'ABSENT') statusAr = 'غائب';
      else if (status === 'EXCUSED') statusAr = 'بعذر';
      
      const message = `تم تسجيل حالة حضورك: [${statusAr}] في محاضرة [${subjectName}]`;

      // 1. SSE Broadcast (privatized by studentId check in client)
      broadcastSSE('ATTENDANCE_RECORDED', {
        studentId,
        message
      });

      // 2. Targeted Push notification — each status has a distinct message
      let pushTitle, pushBody;
      if (status === 'ABSENT') {
        pushTitle = '❌ تسجيل الغياب';
        pushBody = `تم تسجيل غيابك في محاضرة [${subjectName}]. يرجى مراجعة الدكتور لتوضيح السبب.`;
      } else if (status === 'EXCUSED') {
        pushTitle = '🔔 عذر مقبول';
        pushBody = `تم تسجيل غيابك بعذر في محاضرة [${subjectName}]. سيُحتسب الغياب بعذر في كشوف الحضور.`;
      } else {
        pushTitle = '✅ تسجيل الحضور';
        pushBody = message;
      }
      await sendStudentPushNotification(studentId, {
        title: pushTitle,
        body: pushBody,
        url: '/student/home'
      });
    }

    res.status(200).json({ success: true, message: 'Attendance sheet saved successfully.' });
  } catch (error) {
    console.error('[REP-API] Error saving attendance:', error);
    res.status(500).json({ success: false, error: 'Failed to save attendance.' });
  }
});

// 5. POST broadcast notification to group
router.post('/broadcast', verifyToken, isRep, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required.' });
    }

    const broadcastId = require('crypto').randomUUID();

    // Query all students in this representative's group
    const classmates = await prisma.student.findMany({
      where: { groupId: req.user.groupId },
      select: { id: true }
    });

    let createdLog = null;

    if (classmates.length > 0) {
      // Create individual NotificationLogs for each classmate in the group
      await prisma.notificationLog.createMany({
        data: classmates.map(student => ({
          studentId: student.id,
          groupId: req.user.groupId,
          title: '📢 تنبيه من مندوب الدفعة',
          message,
          status: 'SENT',
          broadcastId
        }))
      });

      // Fetch one log to return back to user
      createdLog = await prisma.notificationLog.findFirst({
        where: { broadcastId }
      });
    } else {
      // Fallback: Create a single group-wide log if group has no students
      createdLog = await prisma.notificationLog.create({
        data: {
          groupId: req.user.groupId,
          title: '📢 تنبيه من مندوب الدفعة',
          message,
          status: 'SENT',
          broadcastId
        }
      });
    }

    // Trigger SSE live event
    broadcastSSE('BROADCAST_MESSAGE', { 
      groupId: req.user.groupId, 
      message,
      broadcastId
    });

    // Send push notification
    sendPushNotification(req.user.groupId, {
      title: '📢 تنبيه من مندوب الدفعة',
      body: message,
      url: '/student/home',
      broadcastId
    });

    res.status(201).json({ success: true, data: createdLog });
  } catch (error) {
    console.error('[REP-API] Error sending broadcast:', error);
    res.status(500).json({ success: false, error: 'Failed to send broadcast.' });
  }
});

// 5a. GET broadcasts sent by this representative with detailed read/delivered status
router.get('/broadcasts', verifyToken, isRep, async (req, res) => {
  try {
    // Fetch all logs in this rep's group that have a broadcastId
    const logs = await prisma.notificationLog.findMany({
      where: {
        groupId: req.user.groupId,
        broadcastId: { not: null }
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            idNumber: true
          }
        }
      },
      orderBy: {
        sentTime: 'desc'
      }
    });

    // Group logs by broadcastId in memory
    const broadcastsMap = {};
    for (const log of logs) {
      if (!log.broadcastId) continue;
      if (!broadcastsMap[log.broadcastId]) {
        broadcastsMap[log.broadcastId] = {
          broadcastId: log.broadcastId,
          message: log.message,
          sentTime: log.sentTime,
          recipients: []
        };
      }
      broadcastsMap[log.broadcastId].recipients.push({
        studentId: log.studentId,
        studentName: log.student?.name || 'طالب غير مسجل',
        idNumber: log.student?.idNumber || '—',
        status: log.readAt ? 'READ' : (log.deliveredAt ? 'DELIVERED' : 'PENDING'),
        deliveredAt: log.deliveredAt,
        readAt: log.readAt
      });
    }

    const broadcastsList = Object.values(broadcastsMap).sort((a, b) => new Date(b.sentTime) - new Date(a.sentTime));

    res.status(200).json({ success: true, data: broadcastsList });
  } catch (error) {
    console.error('[REP-API] Error fetching broadcasts list:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch broadcasts list.' });
  }
});

// 6. POST create resource
router.post('/resources', verifyToken, isRep, async (req, res) => {
  try {
    const { title, url } = req.body;
    if (!title || !url) {
      return res.status(400).json({ success: false, error: 'Title and URL are required.' });
    }

    const resource = await prisma.groupResource.create({
      data: {
        title,
        url,
        groupId: req.user.groupId,
        postedById: req.user.id
      }
    });

    res.status(201).json({ success: true, data: resource });
  } catch (error) {
    console.error('[REP-API] Error creating group resource:', error);
    res.status(500).json({ success: false, error: 'Failed to add resource.' });
  }
});

// 7. GET group resources
router.get('/resources', verifyToken, isRep, async (req, res) => {
  try {
    const resources = await prisma.groupResource.findMany({
      where: { groupId: req.user.groupId },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: resources });
  } catch (error) {
    console.error('[REP-API] Error fetching group resources:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch resources.' });
  }
});

// 8. POST reschedule request
router.post('/reschedule', verifyToken, isRep, async (req, res) => {
  try {
    const { scheduleId, requestType, newDayOfWeek, newStartTime, newEndTime, newRoomId, reason } = req.body;

    if (!scheduleId || !requestType) {
      return res.status(400).json({ success: false, error: 'Missing required reschedule fields.' });
    }

    const schedule = await prisma.schedule.findFirst({
      where: { id: parseInt(scheduleId), groupId: req.user.groupId }
    });

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule slot not found or unauthorized.' });
    }

    if (!schedule.lecturerId) {
      return res.status(400).json({ success: false, error: 'This schedule slot does not have an assigned lecturer.' });
    }

    if (requestType === 'RESCHEDULE') {
      if (!newDayOfWeek || !newStartTime || !newEndTime) {
        return res.status(400).json({ success: false, error: 'Rescheduling requires day, start time, and end time.' });
      }

      // Check for room clash
      const targetRoomId = newRoomId ? parseInt(newRoomId) : schedule.roomId;
      const clash = await prisma.schedule.findFirst({
        where: {
          dayOfWeek: newDayOfWeek,
          startTime: newStartTime,
          roomId: targetRoomId,
          collegeId: schedule.collegeId,
          id: { not: parseInt(scheduleId) }
        }
      });
      if (clash) {
        return res.status(409).json({ success: false, error: 'Conflict: Room is already booked for another class during this time slot.' });
      }
    }

    const request = await prisma.rescheduleRequest.create({
      data: {
        scheduleId: parseInt(scheduleId),
        lecturerId: schedule.lecturerId,
        requestType,
        newDayOfWeek: requestType === 'RESCHEDULE' ? newDayOfWeek : null,
        newStartTime: requestType === 'RESCHEDULE' ? newStartTime : null,
        newEndTime: requestType === 'RESCHEDULE' ? newEndTime : null,
        newRoomId: (requestType === 'RESCHEDULE' && newRoomId) ? parseInt(newRoomId) : null,
        reason,
        status: 'PENDING'
      }
    });

    res.status(201).json({ success: true, message: 'Reschedule request submitted to administration.', data: request });
  } catch (error) {
    console.error('[REP-API] Error submitting reschedule request:', error);
    res.status(500).json({ success: false, error: 'Failed to submit reschedule request.' });
  }
});

// 9. GET /api/rep/dashboard/stats
router.get('/dashboard/stats', verifyToken, isRep, async (req, res) => {
  try {
    const totalClassmates = await prisma.student.count({
      where: { groupId: req.user.groupId }
    });
    
    const totalResources = await prisma.groupResource.count({
      where: { groupId: req.user.groupId }
    });
    
    // Overall attendance rate of the group
    const attendanceSummary = await prisma.attendance.groupBy({
      by: ['status'],
      where: {
        student: { groupId: req.user.groupId }
      },
      _count: { id: true }
    });
    
    let presentCount = 0;
    let totalCount = 0;
    attendanceSummary.forEach(item => {
      totalCount += item._count.id;
      if (item.status === 'PRESENT') {
        presentCount += item._count.id;
      }
    });
    
    const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 100;
    
    // Fetch individual classmate stats
    const students = await prisma.student.findMany({
      where: { groupId: req.user.groupId },
      include: {
        attendances: {
          select: { status: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    const classmateStats = students.map(s => {
      const studentTotal = s.attendances.length;
      const studentPresent = s.attendances.filter(a => a.status === 'PRESENT').length;
      const rate = studentTotal > 0 ? Math.round((studentPresent / studentTotal) * 100) : 100;
      return {
        id: s.id,
        name: s.name,
        idNumber: s.idNumber,
        attendanceRate: rate,
        totalClasses: studentTotal,
        presentClasses: studentPresent
      };
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalClassmates,
        totalResources,
        attendanceRate,
        classmateStats
      }
    });
  } catch (error) {
    console.error('[REP-API] Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats.' });
  }
});

// 10. GET /api/rep/reschedule/history
router.get('/reschedule/history', verifyToken, isRep, async (req, res) => {
  try {
    const requests = await prisma.rescheduleRequest.findMany({
      where: {
        schedule: { groupId: req.user.groupId }
      },
      include: {
        schedule: {
          include: { subject: true, room: true }
        },
        newRoom: true,
        lecturer: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('[REP-API] Error fetching reschedule history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch rescheduling requests history.' });
  }
});

// 11. POST /api/rep/students/:id/approve
router.post('/students/:id/approve', verifyToken, isRep, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const repInfo = await prisma.student.findUnique({ where: { id: req.user.id } });
    if (!repInfo) {
      return res.status(404).json({ success: false, error: 'Representative not found.' });
    }
    
    // Verify that the student belongs to the same college, major, and level
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        collegeId: repInfo.collegeId,
        majorId: repInfo.majorId,
        levelId: repInfo.levelId
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found in your cohort.' });
    }

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        isEmailVerified: true,
        isPhoneVerified: true
      }
    });

    res.status(200).json({ success: true, message: 'Student successfully verified.', data: updated });
  } catch (error) {
    console.error('[REP-API] Error approving student:', error);
    res.status(500).json({ success: false, error: 'Failed to approve student.' });
  }
});

// 12. POST /api/rep/students/:id/reject
router.post('/students/:id/reject', verifyToken, isRep, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const repInfo = await prisma.student.findUnique({ where: { id: req.user.id } });
    if (!repInfo) {
      return res.status(404).json({ success: false, error: 'Representative not found.' });
    }

    // Verify that the student belongs to the same college, major, and level
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        collegeId: repInfo.collegeId,
        majorId: repInfo.majorId,
        levelId: repInfo.levelId
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found in your cohort.' });
    }

    // SECURITY: Only allow rejecting students who are NOT yet assigned to a group.
    // Students with a groupId are considered active/verified and CANNOT be deleted by the rep.
    if (student.groupId) {
      return res.status(403).json({
        success: false,
        error: 'لا يمكنك حذف طالب منضم لمجموعة. يرجى مراجعة الإدارة لإجراء أي تعديلات على الطلاب المُفعَّلين.'
      });
    }

    // AUDIT CHECK: Prevent hard delete if the student has existing attendance history.
    // This protects data integrity — attendance records are immutable audit trails.
    const attendanceCount = await prisma.attendance.count({ where: { studentId } });

    if (attendanceCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete student with attendance history. The student has existing attendance records that must be preserved for audit purposes.',
        attendanceEntries: attendanceCount
      });
    }

    await prisma.student.delete({
      where: { id: studentId }
    });

    res.status(200).json({ success: true, message: 'Student successfully rejected.' });
  } catch (error) {
    console.error('[REP-API] Error rejecting student:', error);
    res.status(500).json({ success: false, error: 'Failed to reject student.' });
  }
});

// 13. POST /attendance/qr-token - Generate dynamic QR token for class check-in
router.post('/attendance/qr-token', verifyToken, isRep, async (req, res) => {
  try {
    const { scheduleId } = req.body;
    if (!scheduleId) {
      return res.status(400).json({ success: false, error: 'scheduleId is required' });
    }

    // Verify schedule belongs to representative's group
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: parseInt(scheduleId),
        groupId: req.user.groupId
      }
    });

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule slot not found or unauthorized.' });
    }

    // Sign the token
    const token = jwt.sign(
      { role: 'ATTENDANCE_QR', scheduleId: schedule.id },
      process.env.JWT_SECRET || 'manar_secret_key',
      { expiresIn: '15m' }
    );

    res.status(200).json({ success: true, token });
  } catch (error) {
    console.error('[REP-API] Error generating QR token:', error);
    res.status(500).json({ success: false, error: 'Failed to generate QR token.' });
  }
});

module.exports = router;
