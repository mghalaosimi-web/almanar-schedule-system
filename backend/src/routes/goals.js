const express = require('express');
const { prisma } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { broadcastSSE, sendPushNotification } = require('../services/notifications');

const router = express.Router();

// Helper to check if user is a representative of their group
async function isRep(req, res, next) {
  if (req.user?.role !== 'STUDENT' || !req.user.isRepresentative) {
    return res.status(403).json({ success: false, error: 'Access denied. Representative privileges required.' });
  }

  // Fetch groupId dynamically to prevent stale tokens
  if (!req.user.groupId) {
    try {
      const student = await prisma.student.findUnique({
        where: { id: req.user.id }
      });
      if (student && student.groupId) {
        req.user.groupId = student.groupId;
      } else if (student && student.collegeId) {
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

      if (!req.user.groupId) {
        const globalGroup = await prisma.group.findFirst({
          where: req.user.collegeId ? { collegeId: req.user.collegeId } : {}
        });
        if (globalGroup) {
          req.user.groupId = globalGroup.id;
        }
      }
    } catch (err) {
      console.error('[Goals isRep] Error fetching groupId:', err);
    }
  }

  if (!req.user.groupId) {
    return res.status(200).json({ success: true, data: [] });
  }
  next();
}

// ── STUDENT ENDPOINTS ────────────────────────────────────────────────

// 1. GET all goals for the student's group
router.get('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Access denied. Student account required.' });
    }

    const groupId = req.user.groupId;
    if (!groupId) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Fetch all goals for the group
    const goals = await prisma.academicGoal.findMany({
      where: { groupId },
      include: {
        subject: {
          select: { id: true, name: true, code: true, type: true }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    // Fetch completions by this student
    const completions = await prisma.studentGoalCompletion.findMany({
      where: { studentId: req.user.id }
    });
    const completedGoalIds = new Set(completions.map(c => c.academicGoalId));

    // Map completion flag
    const data = goals.map(g => ({
      ...g,
      completed: completedGoalIds.has(g.id)
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[API] Error fetching student goals:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch academic goals.' });
  }
});

// 2. POST toggle completion status of a goal
router.post('/:id/toggle', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const goalId = parseInt(req.params.id);
    const studentId = req.user.id;

    // Check if goal exists and belongs to the student's group
    const goal = await prisma.academicGoal.findFirst({
      where: { id: goalId, groupId: req.user.groupId }
    });

    if (!goal) {
      return res.status(404).json({ success: false, error: 'Academic goal not found or unauthorized.' });
    }

    const existingCompletion = await prisma.studentGoalCompletion.findUnique({
      where: {
        studentId_academicGoalId: {
          studentId,
          academicGoalId: goalId
        }
      }
    });

    let completed = false;
    if (existingCompletion) {
      await prisma.studentGoalCompletion.delete({
        where: { id: existingCompletion.id }
      });
      completed = false;
    } else {
      await prisma.studentGoalCompletion.create({
        data: {
          studentId,
          academicGoalId: goalId,
          status: 'COMPLETED'
        }
      });
      completed = true;
    }

    res.status(200).json({ success: true, completed });
  } catch (error) {
    console.error('[API] Error toggling goal completion:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle goal completion.' });
  }
});

// 3. GET incomplete goals from past weeks or past sessions (reminders)
router.get('/reminders', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const groupId = req.user.groupId;
    if (!groupId) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Fetch incomplete goals
    const goals = await prisma.academicGoal.findMany({
      where: {
        groupId,
        completions: {
          none: { studentId: req.user.id }
        }
      },
      include: {
        subject: {
          select: { name: true, code: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter goals that are reminders (created before today OR having a past week number or past due date)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reminders = goals.filter(g => {
      // Created before today
      const createdDate = new Date(g.createdAt);
      createdDate.setHours(0, 0, 0, 0);
      if (createdDate < today) return true;

      // Due date is in the past
      if (g.dueDate) {
        const dueDate = new Date(g.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < today) return true;
      }

      return false;
    });

    res.status(200).json({ success: true, data: reminders });
  } catch (error) {
    console.error('[API] Error fetching goal reminders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch goal reminders.' });
  }
});

// ── REPRESENTATIVE ENDPOINTS ────────────────────────────────────────

// 4. POST create a new academic goal for the cohort
router.post('/rep', verifyToken, isRep, async (req, res) => {
  try {
    const { title, description, type, dueDate, weekNumber, subjectId } = req.body;

    if (!title || !type || !subjectId) {
      return res.status(400).json({ success: false, error: 'Title, Type, and Subject are required.' });
    }

    const parsedSubjectId = parseInt(subjectId);
    const parsedWeekNumber = weekNumber ? parseInt(weekNumber) : null;
    const parsedDueDate = dueDate ? new Date(dueDate) : null;

    // Verify subject belongs to the college
    const subject = await prisma.subject.findUnique({
      where: { id: parsedSubjectId }
    });
    if (!subject) {
      return res.status(404).json({ success: false, error: 'Subject not found.' });
    }

    const goal = await prisma.academicGoal.create({
      data: {
        title,
        description,
        type,
        dueDate: parsedDueDate,
        weekNumber: parsedWeekNumber,
        subjectId: parsedSubjectId,
        groupId: req.user.groupId
      },
      include: {
        subject: true
      }
    });

    // ── Notify cohort classmates ──
    const classmates = await prisma.student.findMany({
      where: { groupId: req.user.groupId },
      select: { id: true }
    });

    const typeLabels = {
      ASSIGNMENT: { ar: 'تكليف دراسي جديد', en: 'New Assignment' },
      EXAM: { ar: 'موعد اختبار جديد', en: 'New Exam' },
      PROJECT: { ar: 'مشروع دراسي جديد', en: 'New Project' },
      ACHIEVEMENT: { ar: 'إنجاز أكاديمي جديد', en: 'New Achievement' }
    };

    const label = typeLabels[type] || { ar: 'تنبيه أكاديمي', en: 'Academic Alert' };
    const messageAr = `تمت إضافة ${label.ar}: [${title}] لمقرر [${subject.name}]`;

    if (classmates.length > 0) {
      const broadcastId = require('crypto').randomUUID();

      // Log notifications for all classmates
      await prisma.notificationLog.createMany({
        data: classmates.map(student => ({
          studentId: student.id,
          groupId: req.user.groupId,
          title: `🎯 ${label.ar}`,
          message: messageAr,
          status: 'SENT',
          broadcastId
        }))
      });

      // Dispatch SSE real-time event
      broadcastSSE('BROADCAST_MESSAGE', {
        groupId: req.user.groupId,
        message: messageAr,
        broadcastId
      });

      // Dispatch Push Notification
      sendPushNotification(req.user.groupId, {
        title: `🎯 ${label.ar}`,
        body: messageAr,
        url: '/student/home',
        broadcastId
      });
    }

    res.status(201).json({ success: true, data: goal });
  } catch (error) {
    console.error('[API] Error creating academic goal:', error);
    res.status(500).json({ success: false, error: 'Failed to create academic goal.' });
  }
});

// 5. PUT update an academic goal
router.put('/rep/:id', verifyToken, isRep, async (req, res) => {
  try {
    const goalId = parseInt(req.params.id);
    const { title, description, type, dueDate, weekNumber, subjectId } = req.body;

    const existingGoal = await prisma.academicGoal.findFirst({
      where: { id: goalId, groupId: req.user.groupId }
    });

    if (!existingGoal) {
      return res.status(404).json({ success: false, error: 'Academic goal not found or unauthorized.' });
    }

    const updated = await prisma.academicGoal.update({
      where: { id: goalId },
      data: {
        title: title !== undefined ? title : existingGoal.title,
        description: description !== undefined ? description : existingGoal.description,
        type: type !== undefined ? type : existingGoal.type,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existingGoal.dueDate,
        weekNumber: weekNumber !== undefined ? (weekNumber ? parseInt(weekNumber) : null) : existingGoal.weekNumber,
        subjectId: subjectId !== undefined ? parseInt(subjectId) : existingGoal.subjectId
      },
      include: {
        subject: true
      }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('[API] Error updating academic goal:', error);
    res.status(500).json({ success: false, error: 'Failed to update academic goal.' });
  }
});

// 6. DELETE an academic goal
router.delete('/rep/:id', verifyToken, isRep, async (req, res) => {
  try {
    const goalId = parseInt(req.params.id);

    const existingGoal = await prisma.academicGoal.findFirst({
      where: { id: goalId, groupId: req.user.groupId }
    });

    if (!existingGoal) {
      return res.status(404).json({ success: false, error: 'Academic goal not found or unauthorized.' });
    }

    await prisma.academicGoal.delete({
      where: { id: goalId }
    });

    res.status(200).json({ success: true, message: 'Academic goal deleted successfully.' });
  } catch (error) {
    console.error('[API] Error deleting academic goal:', error);
    res.status(500).json({ success: false, error: 'Failed to delete academic goal.' });
  }
});

module.exports = router;
