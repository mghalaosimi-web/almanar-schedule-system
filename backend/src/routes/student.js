const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { getSseClients, setSseClients, broadcastSSE } = require('../services/notifications');
const systemSettings = require('../services/systemSettings');
const { LOGS_FILE } = require('../middleware/activityLogger');

// استيراد الخدمات المفككة حديثاً لتمرير منطق العمليات
const attendanceService = require('../services/attendanceService');
const scheduleService = require('../services/scheduleService');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Helper for distance calculation (Haversine formula)
function getCoordinateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

// 1. Tenants Endpoint (Get Universities and Colleges)
router.get('/tenants', async (req, res) => {
  try {
    const universities = await prisma.university.findMany({
      orderBy: [
        { sortIndex: 'asc' },
        { name: 'asc' }
      ],
      include: {
        colleges: {
          orderBy: [
            { sortIndex: 'asc' },
            { name: 'asc' }
          ]
        }
      }
    });
    const mapped = universities.map(uni => ({
      ...uni,
      logoUrl: uni.logoUrl ? uni.logoUrl : (uni.slug === 'hajjah-university' ? '/hajjah-logo-new.png' :
               uni.slug === 'almanar-college' ? '/almanar-logo.png' : uni.logoUrl)
    }));
    res.status(200).json({ success: true, data: mapped });
  } catch (error) {
    console.error('[API] Fetch tenants error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tenants' });
  }
});

// 2. Server-Sent Events (SSE) Live Schedule Update Endpoint
router.get('/schedules/live', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  res.write('\n'); // Send initial ping
  
  const token = req.query.token;
  let sseUser = null;
  if (token) {
    try {
      sseUser = jwt.verify(token, JWT_SECRET);
      // Keep alive session
      try {
        const { keepAlive } = require('../services/sessionTracker');
        keepAlive(sseUser);
      } catch (e) {}
    } catch (err) {
      console.warn('[SSE] Token verification failed:', err.message);
    }
  }
  
  const client = { id: Date.now(), res, user: sseUser };
  const clients = getSseClients();
  clients.push(client);
  setSseClients(clients);
  
  console.log(`[SSE] Client connected. Total clients: ${clients.length}`);

  // ── Heartbeat: ping every 25s to prevent proxy/load-balancer timeouts ──
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 25000);
  // ────────────────────────────────────────────────────────────────
  
  req.on('close', () => {
    clearInterval(heartbeat);
    const activeClients = getSseClients().filter(c => c.id !== client.id);
    setSseClients(activeClients);
    console.log(`[SSE] Client disconnected. Total clients: ${activeClients.length}`);
  });
});

// 3. Get Public VAPID Key
router.get('/notifications/vapid-key', (req, res) => {
  res.status(200).json({ success: true, publicKey: process.env.PUBLIC_VAPID_KEY });
});

// 4. Subscribe to Push Notifications
router.post('/notifications/subscribe', verifyToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      return res.status(400).json({ success: false, error: 'Subscription object with endpoint, p256dh, and auth keys is required' });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        studentId: req.user.role === 'STUDENT' ? req.user.id : null,
        adminId: req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN' ? req.user.id : null,
        lecturerId: req.user.role === 'LECTURER' ? req.user.id : null,
      },
      create: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        studentId: req.user.role === 'STUDENT' ? req.user.id : null,
        adminId: req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN' ? req.user.id : null,
        lecturerId: req.user.role === 'LECTURER' ? req.user.id : null,
      }
    });

    res.status(200).json({ success: true, message: 'Subscribed to push notifications successfully' });
  } catch (error) {
    console.error('[API] Subscription error:', error);
    res.status(500).json({ success: false, error: 'Failed to subscribe' });
  }
});

// 5. GET all departments
router.get('/departments', async (req, res) => {
  try {
    const { collegeId } = req.query;
    const filter = collegeId ? { collegeId: parseInt(collegeId) } : {};
    const departments = await prisma.department.findMany({
      where: filter,
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: departments });
  } catch (error) {
    console.error('[API] Error fetching departments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch departments' });
  }
});

// 6. GET all majors
router.get('/majors', async (req, res) => {
  try {
    const { departmentId, collegeId } = req.query;
    const filter = {};
    if (departmentId) {
      filter.departmentId = parseInt(departmentId);
    }
    if (collegeId) {
      filter.department = { collegeId: parseInt(collegeId) };
    }
    const majors = await prisma.major.findMany({
      where: filter,
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: majors });
  } catch (error) {
    console.error('[API] Error fetching majors:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch majors' });
  }
});

// 7. GET all levels
router.get('/levels', async (req, res) => {
  try {
    const levels = await prisma.level.findMany({
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: levels });
  } catch (error) {
    console.error('[API] Error fetching levels:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch levels' });
  }
});

// 8. GET all groups
router.get('/groups', async (req, res) => {
  try {
    const { collegeId, majorId, levelId } = req.query;
    const filter = {};
    if (collegeId) filter.collegeId = parseInt(collegeId);
    if (majorId) filter.majorId = parseInt(majorId);
    if (levelId) filter.levelId = parseInt(levelId);

    const groups = await prisma.group.findMany({
      where: filter,
      include: {
        major: true,
        level: true
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: groups });
  } catch (error) {
    console.error('[API] Error fetching groups:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch groups' });
  }
});

// 9. GET all rooms
router.get('/rooms', verifyToken, async (req, res) => {
  try {
    const { collegeId } = req.query;
    const whereClause = {};
    if (req.user.role !== 'SUPER_ADMIN') {
      whereClause.collegeId = req.user.collegeId;
    } else if (collegeId) {
      whereClause.collegeId = parseInt(collegeId);
    }

    const rooms = await prisma.room.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: rooms });
  } catch (error) {
    console.error('[API] Error fetching rooms:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch rooms' });
  }
});

// 10. GET all lecturers
router.get('/lecturers', verifyToken, async (req, res) => {
  try {
    const { collegeId } = req.query;
    const whereClause = {};
    if (req.user.role !== 'SUPER_ADMIN') {
      whereClause.collegeId = req.user.collegeId;
    } else if (collegeId) {
      whereClause.collegeId = parseInt(collegeId);
    }

    const lecturers = await prisma.lecturer.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: lecturers });
  } catch (error) {
    console.error('[API] Error fetching lecturers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch lecturers' });
  }
});

// 11. GET all schedules
router.get('/schedules', verifyToken, async (req, res) => {
  try {
    const { groupId, collegeId, majorId, levelId, page, limit } = req.query;

    const whereClause = {};
    if (groupId) {
      whereClause.groupId = parseInt(groupId);
    }
    if (majorId && levelId) {
      whereClause.group = {
        majorId: parseInt(majorId),
        levelId: parseInt(levelId)
      };
    }
    
    if (req.user.role !== 'SUPER_ADMIN') {
      whereClause.collegeId = req.user.collegeId;
    } else if (collegeId) {
      whereClause.collegeId = parseInt(collegeId);
    }

    let schedules;
    if (page && limit) {
      const p = parseInt(page) || 1;
      const l = parseInt(limit) || 15;
      const skip = (p - 1) * l;

      schedules = await prisma.schedule.findMany({
        where: whereClause,
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
            where: { date: { gte: new Date() } }
          }
        },
        skip,
        take: l
      });
    } else {
      schedules = await prisma.schedule.findMany({
        where: whereClause,
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
            where: { date: { gte: new Date() } }
          }
        }
      });
    }

    // ── N+1 FIX: batch all "shared class" lookups into ONE query ──────────
    // Build a unique set of composite signatures: dayOfWeek|startTime|subjectId|roomId|collegeId
    const sigOf = (s) => `${s.dayOfWeek}|${s.startTime}|${s.subjectId}|${s.roomId}|${s.collegeId}`;
    const uniqueSigs = [...new Set(schedules.map(sigOf))];

    // Single query fetching ALL schedules that share any of these slots
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

    // Build an in-memory Map: signature → array of attending group entries
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

    // Map each original schedule to its pre-built attendingGroups (O(1) lookup)
    const enriched = schedules.map(sched => ({
      ...sched,
      attendingGroups: sharesMap.get(sigOf(sched)) ?? []
    }));
    // ─────────────────────────────────────────────────────────────────────

    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    console.error('[API] Error fetching schedules:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch schedules' });
  }
});


// 12. GET representative students
router.get('/representative/students', verifyToken, async (req, res) => {
  try {
    const studentInfo = await prisma.student.findUnique({ where: { id: req.user.id } });
    if (!studentInfo || !studentInfo.isRepresentative) {
      return res.status(403).json({ success: false, error: 'Access denied. Representative role required.' });
    }

    const students = await prisma.student.findMany({
      where: {
        collegeId: studentInfo.collegeId,
        majorId: studentInfo.majorId,
        levelId: studentInfo.levelId,
      },
      include: {
        group: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.status(200).json({ success: true, data: students });
  } catch (error) {
    console.error('[API] Error fetching representative students:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch students' });
  }
});

// 13. POST assign student to group
router.post('/representative/assign', verifyToken, async (req, res) => {
  try {
    const { studentIds, groupId } = req.body;
    
    if (!studentIds || !Array.isArray(studentIds) || groupId === undefined) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const studentInfo = await prisma.student.findUnique({ where: { id: req.user.id } });
    if (!studentInfo || !studentInfo.isRepresentative) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (groupId !== null) {
      const group = await prisma.group.findUnique({ where: { id: parseInt(groupId) } });
      if (!group || group.collegeId !== studentInfo.collegeId) {
        return res.status(400).json({ success: false, error: 'Invalid group selection' });
      }
    }

    const updateResult = await prisma.student.updateMany({
      where: {
        id: { in: studentIds.map(id => parseInt(id)) },
        collegeId: studentInfo.collegeId,
        majorId: studentInfo.majorId,
        levelId: studentInfo.levelId
      },
      data: {
        groupId: groupId === null ? null : parseInt(groupId)
      }
    });

    res.status(200).json({ success: true, message: `Assigned ${updateResult.count} students to group.`, updatedCount: updateResult.count });
  } catch (error) {
    console.error('[API] Error assigning students:', error);
    res.status(500).json({ success: false, error: 'Failed to assign students' });
  }
});

// 14. GET student notifications
router.get('/notifications/student', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const logs = await prisma.notificationLog.findMany({
      where: {
        OR: [
          { groupId: req.user.groupId },
          { groupId: null }
        ]
      },
      include: {
        group: true
      },
      orderBy: {
        sentTime: 'desc'
      }
    });

    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error('[API] Error fetching student notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch student notifications' });
  }
});

// 15. PUT student settings
router.put('/student/settings', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { name, password, groupId, departmentName, levelName, phone, email, idPhotoUrl } = req.body;
    const studentId = req.user.id;

    const updateData = {};
    if (name) updateData.name = name;
    if (groupId) updateData.groupId = parseInt(groupId);
    if (idPhotoUrl !== undefined) updateData.idPhotoUrl = idPhotoUrl;

    if (email) {
      const emailClash = await prisma.student.findFirst({
        where: { email, id: { not: studentId } }
      });
      if (emailClash) {
        return res.status(400).json({ success: false, error: 'Email address is already in use by another student.' });
      }
      updateData.email = email;
    }

    if (phone) {
      const phoneClash = await prisma.student.findFirst({
        where: { phone, id: { not: studentId } }
      });
      if (phoneClash) {
        return res.status(400).json({ success: false, error: 'Phone number is already in use by another student.' });
      }
      updateData.phone = phone;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    if (departmentName) {
      let major = await prisma.major.findFirst({
        where: { name: departmentName }
      });
      if (!major) {
        let dept = await prisma.department.findFirst();
        if (!dept) {
          dept = await prisma.department.create({
            data: { name: 'Engineering & IT' }
          });
        }
        major = await prisma.major.create({
          data: { name: departmentName, departmentId: dept.id }
        });
      }
      updateData.majorId = major.id;
    }

    if (levelName) {
      let level = await prisma.level.findFirst({
        where: { name: levelName }
      });
      if (!level) {
        level = await prisma.level.create({
          data: { name: levelName }
        });
      }
      updateData.levelId = level.id;
    }

    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: updateData,
      include: {
        major: true,
        level: true,
        group: true
      }
    });

    res.status(200).json({
      success: true,
      message: 'Student preferences and profile updated successfully.',
      data: {
        id: updatedStudent.id,
        name: updatedStudent.name,
        email: updatedStudent.email,
        phone: updatedStudent.phone,
        idPhotoUrl: updatedStudent.idPhotoUrl,
        groupId: updatedStudent.groupId,
        role: 'STUDENT',
        groupName: updatedStudent.group ? updatedStudent.group.name : '',
        majorName: updatedStudent.major ? updatedStudent.major.name : '',
        levelName: updatedStudent.level ? updatedStudent.level.name : '',
        isRepresentative: updatedStudent.isRepresentative
      }
    });
  } catch (error) {
    console.error('[API] Error updating student settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// 16. GET student settings
router.get('/student/settings', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const student = await prisma.student.findUnique({
      where: { id: req.user.id },
      include: {
        major: {
          include: { department: true }
        },
        level: true,
        group: true
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        id: student.id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        idPhotoUrl: student.idPhotoUrl,
        groupId: student.groupId,
        groupName: student.group ? student.group.name : '',
        majorId: student.majorId,
        majorName: student.major ? student.major.name : '',
        departmentName: student.major?.department ? student.major.department.name : '',
        levelId: student.levelId,
        levelName: student.level ? student.level.name : '',
        isEmailVerified: student.isEmailVerified,
        isPhoneVerified: student.isPhoneVerified,
        isRepresentative: student.isRepresentative
      }
    });
  } catch (error) {
    console.error('[API] Error fetching student settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

// 17. GET student attendance stats
/**
 * مسار جلب ملخص إحصائيات حضور وغياب الطالب الإجمالية.
 * 
 * البيانات الواردة:
 * - التوثيق: Bearer Token في رأس الطلب (Headers).
 * البيانات الصادرة (Response):
 * - success: true
 * - data: { percentage: number, present: number, late: number, absent: number, total: number }
 */
router.get('/student/attendance/stats', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Forbidden: Student access required' });
    }

    const stats = await attendanceService.getAttendanceStatsSummary(req.user.id);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('[API] Error fetching student attendance stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance stats' });
  }
});

// 18. POST Scan QR Check-in
/**
 * مسار تسجيل الحضور ومسح رمز الاستجابة السريعة (QR Code).
 * 
 * البيانات الواردة (Payload):
 * - token: الرمز المشفر المولد للحصة (string).
 * - latitude: خط العرض للموقع الحالي للطلاب (number).
 * - longitude: خط الطول للموقع الحالي للطلاب (number).
 * البيانات الصادرة (Response):
 * - success: true
 * - message: رسالة تأكيد الحضور أو التأخير باللغة العربية.
 * - data: كائن سجل الحضور المحدث.
 */
router.post('/attendance/scan', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Forbidden: Student access required' });
    }

    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Missing QR code token' });
    }

    const record = await attendanceService.scanCheckIn(req.user.id, token);
    
    res.status(200).json({
      success: true,
      message: record.status === 'PRESENT' ? 'تم تسجيل حضورك بنجاح!' : 'تم تسجيل حضورك (متأخر)!',
      data: record
    });
  } catch (error) {
    console.error('[API] Error scanning attendance:', error.message);
    res.status(400).json({ success: false, error: error.message || 'Failed to record attendance' });
  }
});

// 18.5 POST GPS Check-In
router.post('/student/attendance/checkin', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Forbidden: Student access required' });
    }

    if (systemSettings.get('disableAttendance')) {
      return res.status(400).json({ success: false, error: 'تسجيل الحضور معطل حالياً من قبل الإدارة' });
    }

    const { scheduleId, bypassGPS, latitude, longitude } = req.body;
    if (!scheduleId) {
      return res.status(400).json({ success: false, error: 'Missing scheduleId' });
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id: parseInt(scheduleId) },
      include: { subject: true, room: true }
    });

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    // Default coordinates: Sanaa / Hajjah campus
    const collegeLat = 15.35;
    const collegeLon = 44.20;
    
    if (!bypassGPS) {
      if (!latitude || !longitude) {
        return res.status(400).json({ success: false, error: 'الرجاء تفعيل خدمات الموقع الجغرافي (GPS)' });
      }
      const distance = getCoordinateDistance(latitude, longitude, collegeLat, collegeLon);
      if (distance > 150) {
        return res.status(400).json({ success: false, error: `أنت خارج نطاق الحرم الجامعي المسموح به. المسافة الحالية: ${Math.round(distance)} متر.` });
      }
    }

    const now = new Date();
    const DAYS_MAP = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const todayDay = DAYS_MAP[now.getDay()];

    let status = 'PRESENT';
    if (schedule.dayOfWeek === todayDay) {
      const [schedHours, schedMins] = schedule.startTime.split(':').map(Number);
      const schedTimeInMinutes = schedHours * 60 + schedMins;
      const nowTimeInMinutes = now.getHours() * 60 + now.getMinutes();

      if (nowTimeInMinutes > schedTimeInMinutes + 15) {
        status = 'LATE';
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.attendance.findFirst({
      where: {
        studentId: req.user.id,
        scheduleId: parseInt(scheduleId),
        date: today
      }
    });

    let record;
    if (existing) {
      record = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status,
          recordedById: req.user.id
        },
        include: {
          student: true
        }
      });
    } else {
      record = await prisma.attendance.create({
        data: {
          studentId: req.user.id,
          scheduleId: parseInt(scheduleId),
          date: today,
          status,
          recordedById: req.user.id
        },
        include: {
          student: true
        }
      });
    }

    // Broadcast update via SSE
    broadcastSSE('ATTENDANCE_MARKED', {
      scheduleId: parseInt(scheduleId),
      studentId: req.user.id,
      studentName: record.student.name,
      status: record.status,
      scannedAt: record.date
    });

    res.status(200).json({
      success: true,
      message: record.status === 'PRESENT' ? 'تم تسجيل حضورك بنجاح بالـ GPS!' : 'تم تسجيل حضورك بالـ GPS (متأخر)!',
      data: record
    });
  } catch (error) {
    console.error('[API] GPS checkin error:', error);
    res.status(500).json({ success: false, error: 'Failed to record attendance: ' + error.message });
  }
});


// 19. GET Database Status Check
router.get('/db/status', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const uniCount = await prisma.university.count().catch(() => 0);
    const collegeCount = await prisma.college.count().catch(() => 0);
    const studentCount = await prisma.student.count().catch(() => 0);
    res.status(200).json({
      success: true,
      seeded: uniCount > 0,
      counts: {
        universities: uniCount,
        colleges: collegeCount,
        students: studentCount
      }
    });
  } catch (error) {
    console.error('[API] DB status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 20. POST Database Seed
router.post('/db/seed', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const uniCount = await prisma.university.count().catch(() => 0);
    if (uniCount > 0) {
      return res.status(200).json({
        success: true,
        seeded: false,
        message: `Database already populated with ${uniCount} universities. Seeding skipped to avoid data wipe.`
      });
    }

    console.log('[API] Triggering database seeding via API request...');
    const { exec } = require('child_process');
    const seedPath = path.join(__dirname, '../../prisma/seed.js');
    exec(`node "${seedPath}"`, (err, stdout, stderr) => {
      if (err) {
        console.error('[DATABASE] API-triggered seeding process failed:', err.message);
        console.error(stderr);
      } else {
        console.log('[DATABASE] API-triggered seeding completed successfully.');
        if (stdout) console.log(stdout);
      }
    });

    res.status(202).json({
      success: true,
      seeded: true,
      message: 'Database is empty. Seeding process has been triggered in the background.'
    });
  } catch (error) {
    console.error('[API] Trigger seed error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 20.5 GET Activity Logs (Protected: Admin/Super Admin only)
router.get('/db/activity-log', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    if (!fs.existsSync(LOGS_FILE)) {
      return res.status(200).json({ success: true, data: [] });
    }
    const fileContent = fs.readFileSync(LOGS_FILE, 'utf8');
    const lines = fileContent.trim().split('\n').reverse().slice(0, 150); // last 150 entries
    res.status(200).json({ success: true, data: lines });
  } catch (error) {
    console.error('[API] Error reading activity log:', error);
    res.status(500).json({ success: false, error: 'Failed to read activity logs' });
  }
});

// 21. POST Feedback / Suggestion Endpoint
router.post('/feedback', verifyToken, async (req, res) => {
  try {
    const { category, message, rating } = req.body;
    if (!category || !message) {
      return res.status(400).json({ success: false, error: 'Category and message are required' });
    }

    let userDetails = { name: req.user.name, role: req.user.role, email: 'unknown@manar.edu' };
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { id: req.user.id } });
      if (student) userDetails.email = student.email;
    } else if (req.user.role === 'LECTURER') {
      const lecturer = await prisma.lecturer.findUnique({ where: { id: req.user.id } });
      if (lecturer) userDetails.email = lecturer.email;
    } else if (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
      const admin = await prisma.admin.findUnique({ where: { id: req.user.id } });
      if (admin) userDetails.email = admin.email;
    }

    // Persist feedback to database (replaces feedback.json file storage)
    // Only student-authenticated requests can create a Feedback row with a relation.
    // Non-student roles (LECTURER, ADMIN) still store a message via category field.
    const feedbackData = {
      message,
      category,
      rating: rating !== undefined ? parseInt(rating) : null
    };
    if (req.user.role === 'STUDENT') {
      feedbackData.studentId = req.user.id;
    } else {
      // For non-students: create a synthetic student-less record using a sentinel student row
      // OR simply log to DB via a nullable studentId extension.
      // Since the current schema requires studentId, we log the extra context via the message field.
      feedbackData.message = `[${userDetails.role}] ${userDetails.name} (${userDetails.email}): ${message}`;
      // We still need a studentId reference — for non-students, skip DB and rely on email only
    }

    if (req.user.role === 'STUDENT') {
      await prisma.feedback.create({ data: feedbackData });
      console.log(`[FEEDBACK] Saved to database for studentId=${req.user.id}, category=${category}`);
    } else {
      console.log(`[FEEDBACK] Non-student feedback logged (email only): role=${userDetails.role}, category=${category}`);
    }

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
          from: `"بوابة الطالب - اقتراحات" <${process.env.EMAIL_USER}>`,
          to: 'm.gh.alaosimi@gmail.com',
          subject: `💡 اقتراح جديد من: ${userDetails.name} (${category})`,
          text: `اقتراح جديد تم إرساله من النظام:\n\nالاسم: ${userDetails.name}\nالدور: ${userDetails.role}\nالبريد: ${userDetails.email}\nالتصنيف: ${category}\n\nالرسالة:\n${message}`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right; color: #333; max-width: 500px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
              <div style="background-color: #3b82f6; padding: 20px; text-align: center;">
                <h2 style="color: #fff; margin: 0;">💡 اقتراح/ملاحظة جديدة</h2>
              </div>
              <div style="padding: 20px;">
                <p><strong>الاسم:</strong> ${userDetails.name}</p>
                <p><strong>نوع الحساب:</strong> ${userDetails.role}</p>
                <p><strong>البريد الإلكتروني:</strong> ${userDetails.email}</p>
                <p><strong>التصنيف:</strong> <span style="background-color: #eff6ff; padding: 2px 8px; border-radius: 4px; border: 1px solid #bfdbfe; font-weight: bold; color: #1e3a8a;">${category}</span></p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p><strong>الرسالة:</strong></p>
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #f3f4f6; font-size: 14px; white-space: pre-wrap; line-height: 1.6;">${message}</div>
              </div>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[FEEDBACK] Email notification sent successfully to developer.`);
      } catch (emailErr) {
        console.warn('[FEEDBACK] Failed to send email to developer:', emailErr.message);
      }
    }

    res.status(201).json({ success: true, message: 'Thank you for your feedback!' });
  } catch (error) {
    console.error('[API] Feedback error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


// 22. GET Student Attendance Stats grouped by Subject
/**
 * مسار استرجاع إحصائيات حضور الطالب مفصلة ومجمعة حسب كل مادة دراسية.
 * 
 * البيانات الواردة:
 * - التوثيق: Bearer Token.
 * البيانات الصادرة (Response):
 * - success: true
 * - data: مصفوفة تحتوي على تفاصيل حضور وغياب كل مادة ونسبها والإنذارات الأكاديمية.
 */
router.get('/student/attendance-stats', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Forbidden: Student access required' });
    }

    const statsList = await attendanceService.getAttendanceStatsBySubject(req.user.id);
    res.status(200).json({ success: true, data: statsList });
  } catch (error) {
    console.error('[API] Error fetching student attendance stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance stats' });
  }
});

// 23. GET Export Schedule in iCalendar (.ics) format
/**
 * مسار تصدير وتنزيل الجدول الدراسي للطالب بصيغة تقويم التقني (.ics).
 * 
 * البيانات الواردة:
 * - التوثيق: Bearer Token.
 * البيانات الصادرة (Response Headers & Body):
 * - Content-Type: text/calendar
 * - Content-Disposition: attachment; filename="schedule.ics"
 * - المحتوى: نص ملف iCalendar المولد.
 */
router.get('/student/export-schedule', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Forbidden: Student access required' });
    }
    
    const icsContent = await scheduleService.exportScheduleToICS(req.user.id);

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename="schedule.ics"');
    res.send(icsContent);
  } catch (error) {
    console.error('[API] Schedule export error:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to export schedule' });
  }
});

const studentController = require('../controllers/studentController');

// GET /api/student/:id - Fetch user-specific data with isolation
router.get('/student/:id', verifyToken, studentController.getStudentById);

// PUT /api/student/:id - Modify user-specific data with isolation
router.put('/student/:id', verifyToken, studentController.updateStudentById);

module.exports = router;
