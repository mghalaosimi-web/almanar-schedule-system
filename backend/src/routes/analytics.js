const express = require('express');
const { calculateAttendanceRisk, analyzeCoursePerformance } = require('../services/analyticsEngine');
const { verifyToken, requirePermission } = require('../middleware/auth');
const adminService = require('../services/adminService');

const router = express.Router();

/**
 * GET /api/analytics/risk-report
 * Attendance Risk Classification Report (< 75% HIGH risk)
 * Guarded by requirePermission('ANALYTICS_VIEW')
 */
router.get('/analytics/risk-report', verifyToken, requirePermission('ANALYTICS_VIEW'), async (req, res) => {
  try {
    const { collegeId, groupId } = req.query;
    const studentScope = adminService.getModelScope(req.user, 'Student');
    const targetCollegeId = collegeId ? parseInt(collegeId) : req.user.collegeId;

    const riskReport = await calculateAttendanceRisk({
      collegeId: targetCollegeId,
      groupId: groupId ? parseInt(groupId) : undefined,
      userScope: studentScope
    });

    res.status(200).json({
      success: true,
      data: riskReport
    });

  } catch (error) {
    console.error('[API] Analytics risk report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate attendance risk report'
    });
  }
});

/**
 * GET /api/analytics/course-performance
 * Course Failure & Absence Rate Analytics with Automated Recommendations
 * Guarded by requirePermission('ANALYTICS_VIEW')
 */
router.get('/analytics/course-performance', verifyToken, requirePermission('ANALYTICS_VIEW'), async (req, res) => {
  try {
    const { collegeId } = req.query;
    const subjectScope = adminService.getModelScope(req.user, 'Subject');
    const targetCollegeId = collegeId ? parseInt(collegeId) : req.user.collegeId;

    const coursePerformance = await analyzeCoursePerformance({
      collegeId: targetCollegeId,
      userScope: subjectScope
    });

    res.status(200).json({
      success: true,
      data: coursePerformance
    });

  } catch (error) {
    console.error('[API] Analytics course performance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate course performance report'
    });
  }
});

module.exports = router;
