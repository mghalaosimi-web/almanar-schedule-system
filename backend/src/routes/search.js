const express = require('express');
const { searchEnterprise } = require('../services/searchEngine');
const { verifyToken, requirePermission } = require('../middleware/auth');
const adminService = require('../services/adminService');

const router = express.Router();

/**
 * GET /api/search
 * Enterprise Full-Text & Relational Search
 * Query Params:
 * - q: Search text (required)
 * - type: ALL | STUDENT | SCHEDULE | LECTURER | ROOM
 * Guarded by requirePermission('SEARCH_VIEW')
 */
router.get('/search', verifyToken, requirePermission('SEARCH_VIEW'), async (req, res) => {
  try {
    const { q, type = 'ALL', collegeId } = req.query;

    if (!q || String(q).trim().length < 2) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Search query must contain at least 2 characters.'
      });
    }

    const userScope = {
      student: adminService.getModelScope(req.user, 'Student'),
      schedule: adminService.getModelScope(req.user, 'Schedule'),
      lecturer: adminService.getModelScope(req.user, 'Lecturer')
    };

    const targetCollegeId = collegeId ? parseInt(collegeId) : req.user.collegeId;

    const results = await searchEnterprise({
      query: String(q),
      type: String(type).toUpperCase(),
      collegeId: targetCollegeId,
      userScope
    });

    res.status(200).json({
      success: true,
      data: results,
      totalCount: results.length
    });

  } catch (error) {
    console.error('[API] Enterprise search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute enterprise search'
    });
  }
});

module.exports = router;
