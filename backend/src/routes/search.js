const express = require('express');
const { searchEnterprise } = require('../services/searchEngine');
const { verifyToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/search
 * Enterprise Full-Text & Relational Search
 */
router.get('/search', verifyToken, requirePermission('SEARCH_VIEW'), async (req, res) => {
  try {
    const { q, type = 'ALL' } = req.query;

    if (!q || String(q).trim().length < 2) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Search query must contain at least 2 characters.'
      });
    }

    const results = await searchEnterprise({
      query: String(q),
      type: String(type).toUpperCase()
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
