const express = require('express');
const { prisma } = require('../db');

const router = express.Router();

// GET /api/public/tenant/info
router.get('/tenant/info', async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      themeColor: '#059669',
      logoUrl: '/almanar-logo.png',
      college: {
        id: 1,
        name: 'كلية المنار الجامعية',
        slug: 'almanar-college',
        location: 'صنعاء'
      }
    }
  });
});

// GET /api/public/majors
router.get('/majors', async (req, res) => {
  try {
    const majors = await prisma.major.findMany({
      select: {
        id: true,
        name: true,
        department: {
          select: { id: true, name: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.status(200).json({
      success: true,
      data: majors
    });
  } catch (error) {
    console.error('[PUBLIC API] Error fetching majors:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch majors' });
  }
});

// GET /api/public/schedules?majorId=...
router.get('/schedules', async (req, res) => {
  try {
    const { majorId, page, limit } = req.query;
    const whereClause = {};

    if (majorId && majorId !== 'ALL') {
      whereClause.group = {
        majorId: parseInt(majorId)
      };
    }

    const p = page ? parseInt(page) : null;
    const l = limit ? parseInt(limit) : null;
    const skip = p && l ? (p - 1) * l : null;

    const queryOptions = {
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
          include: {
            newRoom: true
          }
        }
      },
      orderBy: { id: 'asc' }
    };

    if (l !== null) {
      queryOptions.take = l;
      if (skip !== null) {
        queryOptions.skip = skip;
      }
    }

    const schedules = await prisma.schedule.findMany(queryOptions);

    res.status(200).json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('[PUBLIC API] Error fetching schedules:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
