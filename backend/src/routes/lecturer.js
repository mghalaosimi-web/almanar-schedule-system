const express = require('express');
const jwt = require('jsonwebtoken');
const { prisma } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { broadcastSSE } = require('../services/notifications');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// 1. GET Lecturer's assigned schedule
router.get('/lecturer/schedule', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'LECTURER') {
      return res.status(403).json({ success: false, error: 'Forbidden: Lecturer access required' });
    }
    const schedules = await prisma.schedule.findMany({
      where: { lecturerId: req.user.id },
      include: {
        subject: true,
        room: true,
        group: {
          include: {
            major: true,
            level: true
          }
        },
        overrides: {
          where: { date: { gte: new Date() } },
          include: { newRoom: true }
        }
      }
    });

    // ── N+1 FIX: batch all "shared class" lookups into ONE query ──────────
    const sigOf = (s) => `${s.dayOfWeek}|${s.startTime}|${s.subjectId}|${s.roomId}|${s.collegeId}`;
    const uniqueSigs = [...new Set(schedules.map(sigOf))];

    const allSharedSchedules = uniqueSigs.length > 0
      ? await prisma.schedule.findMany({
          where: {
            OR: uniqueSigs.map(sig => {
              const [dayOfWeek, startTime, subjectId, roomId, collegeId] = sig.split('|');
              return {
                dayOfWeek,
                startTime,
                subjectId: parseInt(subjectId),
                roomId: parseInt(roomId),
                collegeId: parseInt(collegeId)
              };
            })
          },
          include: {
            group: {
              include: { major: true }
            }
          }
        })
      : [];

    const sharesMap = new Map();
    for (const s of allSharedSchedules) {
      const key = sigOf(s);
      if (!sharesMap.has(key)) sharesMap.set(key, []);
      sharesMap.get(key).push({
        groupId: s.groupId,
        groupName: s.group?.name,
        majorId: s.group?.majorId,
        majorName: s.group?.major?.name
      });
    }

    const enriched = schedules.map(sched => ({
      ...sched,
      attendingGroups: sharesMap.get(sigOf(sched)) ?? []
    }));
    // ─────────────────────────────────────────────────────────────────────

    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    console.error('[API] Error fetching lecturer schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch lecturer schedule' });
  }
});


// 2. POST a new rescheduling/cancellation request
router.post('/lecturer/requests', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'LECTURER') {
      return res.status(403).json({ success: false, error: 'Forbidden: Lecturer access required' });
    }
    const { scheduleId, requestType, newDayOfWeek, newStartTime, newEndTime, newRoomId, reason } = req.body;

    if (!scheduleId || !requestType) {
      return res.status(400).json({ success: false, error: 'Missing required request fields' });
    }

    const schedule = await prisma.schedule.findFirst({
      where: { id: parseInt(scheduleId), lecturerId: req.user.id }
    });
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Lecturer schedule not found' });
    }

    // Check for room clash if it's a reschedule
    if (requestType === 'RESCHEDULE') {
      if (!newDayOfWeek || !newStartTime || !newEndTime) {
        return res.status(400).json({ success: false, error: 'Rescheduling requires day, start time, and end time' });
      }
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
        lecturerId: req.user.id,
        requestType,
        newDayOfWeek: requestType === 'RESCHEDULE' ? newDayOfWeek : null,
        newStartTime: requestType === 'RESCHEDULE' ? newStartTime : null,
        newEndTime: requestType === 'RESCHEDULE' ? newEndTime : null,
        newRoomId: (requestType === 'RESCHEDULE' && newRoomId) ? parseInt(newRoomId) : null,
        reason,
        status: 'PENDING'
      }
    });

    res.status(201).json({ success: true, message: 'Request submitted successfully', data: request });
  } catch (error) {
    console.error('[API] Error submitting request:', error);
    res.status(500).json({ success: false, error: 'Failed to submit request' });
  }
});

// 3. GET Lecturer's submitted requests
router.get('/lecturer/requests', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'LECTURER') {
      return res.status(403).json({ success: false, error: 'Forbidden: Lecturer access required' });
    }
    const requests = await prisma.rescheduleRequest.findMany({
      where: { lecturerId: req.user.id },
      include: {
        schedule: {
          include: { subject: true, room: true, group: true }
        },
        newRoom: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('[API] Error fetching lecturer requests:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch requests' });
  }
});

// 4. GET QR Check-in Token (Lecturer only)
router.get('/lecturer/attendance/token', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'LECTURER') {
      return res.status(403).json({ success: false, error: 'Forbidden: Lecturer access required' });
    }
    const { scheduleId } = req.query;
    if (!scheduleId) {
      return res.status(400).json({ success: false, error: 'Missing scheduleId query parameter' });
    }

    const schedule = await prisma.schedule.findFirst({
      where: { id: parseInt(scheduleId), lecturerId: req.user.id }
    });

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found or not owned by lecturer' });
    }

    // Generate token with 15 seconds expiration
    const token = jwt.sign(
      { scheduleId: schedule.id, role: 'ATTENDANCE_QR', timestamp: Date.now() },
      JWT_SECRET,
      { expiresIn: '15s' }
    );

    res.status(200).json({ success: true, token });
  } catch (error) {
    console.error('[API] Error generating QR token:', error);
    res.status(500).json({ success: false, error: 'Failed to generate attendance token' });
  }
});

// 5. GET Attendance Report for a schedule (Lecturer only)
router.get('/lecturer/attendance/report', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'LECTURER') {
      return res.status(403).json({ success: false, error: 'Forbidden: Lecturer access required' });
    }

    const { scheduleId, date } = req.query;
    if (!scheduleId) {
      return res.status(400).json({ success: false, error: 'Missing scheduleId parameter' });
    }

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const schedule = await prisma.schedule.findFirst({
      where: { id: parseInt(scheduleId), lecturerId: req.user.id },
      include: {
        group: {
          include: {
            students: {
              orderBy: { name: 'asc' }
            }
          }
        }
      }
    });

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found or not owned by lecturer' });
    }

    // Fetch existing records for this day from the unified Attendance table
    const records = await prisma.attendance.findMany({
      where: {
        scheduleId: schedule.id,
        date: targetDate
      }
    });

    // Merge group students with attendance records
    const report = schedule.group.students.map(student => {
      const record = records.find(r => r.studentId === student.id);
      return {
        studentId: student.id,
        studentName: student.name,
        idNumber: student.idNumber,
        email: student.email,
        status: record ? record.status : 'ABSENT',
        scannedAt: record ? record.date : null
      };
    });

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('[API] Error fetching attendance report:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance report' });
  }
});

// 6. GET Export Attendance as CSV
router.get('/lecturer/attendance/export/:scheduleId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'LECTURER') {
      return res.status(403).json({ success: false, error: 'Forbidden: Lecturer access required' });
    }
    const scheduleId = parseInt(req.params.scheduleId);

    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, lecturerId: req.user.id },
      include: {
        group: {
          include: {
            students: {
              orderBy: { name: 'asc' }
            }
          }
        }
      }
    });

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found or unauthorized' });
    }

    // Fetch all attendance records for this schedule
    const attendances = await prisma.attendance.findMany({
      where: { scheduleId },
      orderBy: { date: 'asc' }
    });

    // Create CSV content starting with UTF-8 BOM to display Arabic correctly in Excel
    let csvContent = '\uFEFF';
    csvContent += 'Name,ID Number,Date,Status\n';

    schedule.group.students.forEach(student => {
      const studentRecords = attendances.filter(a => a.studentId === student.id);
      
      if (studentRecords.length === 0) {
        csvContent += `"${student.name}","${student.idNumber}","N/A","N/A"\n`;
      } else {
        studentRecords.forEach(rec => {
          const dateStr = new Date(rec.date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
          csvContent += `"${student.name}","${student.idNumber}","${dateStr}","${rec.status}"\n`;
        });
      }
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-schedule-${scheduleId}.csv`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('[API] CSV Export error:', error);
    res.status(500).json({ success: false, error: 'Failed to export attendance data' });
  }
});

const lecturerController = require('../controllers/lecturerController');

// GET /api/lecturer/:id - Fetch user-specific data with isolation
router.get('/lecturer/:id', verifyToken, lecturerController.getLecturerById);

// PUT /api/lecturer/:id - Modify user-specific data with isolation
router.put('/lecturer/:id', verifyToken, lecturerController.updateLecturerById);

module.exports = router;
