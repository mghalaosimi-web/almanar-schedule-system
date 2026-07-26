const express = require('express');
const {
  calculateStudentSuccessIndex,
  recommendOptimalTimeSlots,
  generateExecutiveReport
} = require('../services/aiAdvisor');
const { verifyToken, requirePermission } = require('../middleware/auth');
const adminService = require('../services/adminService');

const router = express.Router();

/**
 * GET /api/ai/predictive-success
 * Predictive Student Success Index (PSI) and Early Warning System
 */
router.get('/ai/predictive-success', verifyToken, requirePermission('ANALYTICS_VIEW'), async (req, res) => {
  try {
    const { collegeId, groupId } = req.query;
    const studentScope = adminService.getModelScope(req.user, 'Student');
    const targetCollegeId = collegeId ? parseInt(collegeId) : req.user.collegeId;

    const successIndex = await calculateStudentSuccessIndex({
      collegeId: targetCollegeId,
      groupId: groupId ? parseInt(groupId) : undefined,
      userScope: studentScope
    });

    res.status(200).json({
      success: true,
      data: successIndex
    });
  } catch (error) {
    console.error('[API] Error calculating student success index:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate predictive success index'
    });
  }
});

/**
 * POST /api/ai/recommend-slot
 * Conflict-Free Schedule Reschedule Recommendation Advisor
 */
router.post('/ai/recommend-slot', verifyToken, requirePermission('SCHEDULE.EDIT'), async (req, res) => {
  try {
    const { groupId, lecturerId, collegeId, durationMinutes } = req.body;
    if (!groupId) {
      return res.status(400).json({ success: false, error: 'groupId is required for slot recommendation' });
    }

    const targetCollegeId = collegeId ? parseInt(collegeId) : (req.user.collegeId || 1);

    const recommendations = await recommendOptimalTimeSlots({
      collegeId: targetCollegeId,
      groupId: parseInt(groupId),
      lecturerId: lecturerId ? parseInt(lecturerId) : null,
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : 90
    });

    res.status(200).json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('[API] Error recommending time slot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate optimal slot recommendations'
    });
  }
});

/**
 * GET /api/ai/executive-report
 * Automated AI Operational Executive Summary
 */
router.get('/ai/executive-report', verifyToken, requirePermission('VIEW_ADMIN_OVERVIEW'), async (req, res) => {
  try {
    const { collegeId } = req.query;
    const targetCollegeId = collegeId ? parseInt(collegeId) : req.user.collegeId;

    const reportData = await generateExecutiveReport({
      collegeId: targetCollegeId
    });

    res.status(200).json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('[API] Error generating executive report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate executive report'
    });
  }
});

module.exports = router;
