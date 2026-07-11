const express = require('express');
const { prisma } = require('../db');

const router = express.Router();

// GET /api/public/tenant/info?slug=...
router.get('/tenant/info', async (req, res) => {
  try {
    const { slug } = req.query;
    if (!slug) {
      return res.status(400).json({ success: false, error: 'Slug query parameter is required' });
    }

    // Try finding by college slug first
    let config = await prisma.tenantConfig.findFirst({
      where: {
        college: { slug }
      },
      include: {
        college: {
          select: {
            id: true,
            name: true,
            slug: true,
            universityId: true,
            university: {
              select: { id: true, name: true, slug: true, themeColor: true, logoUrl: true, governorateId: true }
            }
          }
        }
      }
    });

    if (!config) {
      const college = await prisma.college.findUnique({
        where: { slug }
      });
      if (college) {
        config = await prisma.tenantConfig.create({
          data: {
            collegeId: college.id,
            themeColor: '#60c4ff',
            enabledFeatures: {
              qrAttendance: true,
              notifications: true
            }
          },
          include: {
            college: {
              select: {
                id: true,
                name: true,
                slug: true,
                universityId: true,
                university: {
                  select: { id: true, name: true, slug: true, themeColor: true, logoUrl: true, governorateId: true }
                }
              }
            }
          }
        });
      }
    }

    // Try finding by university slug
    if (!config) {
      config = await prisma.tenantConfig.findFirst({
        where: {
          university: { slug }
        },
        include: {
          university: {
            select: { id: true, name: true, slug: true, themeColor: true, logoUrl: true, governorateId: true }
          }
        }
      });

      if (!config) {
        const university = await prisma.university.findUnique({
          where: { slug }
        });
        if (university) {
          config = await prisma.tenantConfig.create({
            data: {
              universityId: university.id,
              themeColor: university.themeColor || '#60c4ff',
              logoUrl: university.logoUrl,
              enabledFeatures: {
                qrAttendance: true,
                notifications: true
              }
            },
            include: {
              university: {
                select: { id: true, name: true, slug: true, themeColor: true, logoUrl: true, governorateId: true }
              }
            }
          });
        }
      }
    }

    if (!config) {
      return res.status(404).json({ success: false, error: 'Tenant configuration not found for this slug' });
    }

    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('[PUBLIC API] Error fetching tenant config:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 1. GET /api/public/governorates
router.get('/governorates', async (req, res) => {
  try {
    const governorates = await prisma.governorate.findMany({
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      data: governorates
    });
  } catch (error) {
    console.error('[PUBLIC API] Error fetching governorates:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 2. GET /api/public/universities?govId=...
router.get('/universities', async (req, res) => {
  try {
    const { govId } = req.query;
    if (!govId) {
      return res.status(400).json({ success: false, error: 'govId query parameter is required' });
    }

    const universities = await prisma.university.findMany({
      where: {
        governorateId: govId
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        themeColor: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      data: universities
    });
  } catch (error) {
    console.error('[PUBLIC API] Error fetching universities:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 3. GET /api/public/colleges?uniId=...
router.get('/colleges', async (req, res) => {
  try {
    const { uniId } = req.query;
    if (!uniId) {
      return res.status(400).json({ success: false, error: 'uniId query parameter is required' });
    }

    const colleges = await prisma.college.findMany({
      where: {
        universityId: parseInt(uniId)
      },
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      data: colleges
    });
  } catch (error) {
    console.error('[PUBLIC API] Error fetching colleges:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 4. GET /api/public/majors?collegeId=...
router.get('/majors', async (req, res) => {
  try {
    const { collegeId } = req.query;
    if (!collegeId) {
      return res.status(400).json({ success: false, error: 'collegeId query parameter is required' });
    }

    const departments = await prisma.department.findMany({
      where: {
        collegeId: parseInt(collegeId)
      },
      select: {
        majors: {
          select: {
            id: true,
            name: true
          },
          orderBy: {
            name: 'asc'
          }
        }
      }
    });

    const majors = departments.flatMap(d => d.majors);

    // Remove potential duplicates by name or ID just in case
    const uniqueMap = new Map();
    majors.forEach(m => uniqueMap.set(m.id, m));
    const uniqueMajors = Array.from(uniqueMap.values());

    res.status(200).json({
      success: true,
      data: uniqueMajors
    });
  } catch (error) {
    console.error('[PUBLIC API] Error fetching majors:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 5. GET /api/public/schedules?collegeId=...&majorId=...
router.get('/schedules', async (req, res) => {
  try {
    const { collegeId, majorId, page, limit } = req.query;
    if (!collegeId) {
      return res.status(400).json({ success: false, error: 'collegeId query parameter is required' });
    }

    const whereClause = {
      collegeId: parseInt(collegeId)
    };

    if (majorId) {
      whereClause.group = {
        majorId: parseInt(majorId)
      };
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
            include: {
              newRoom: true
            }
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
            include: {
              newRoom: true
            }
          }
        }
      });
    }

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

    res.status(200).json({
      success: true,
      data: enriched
    });
  } catch (error) {
    console.error('[PUBLIC API] Error fetching schedules:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;


