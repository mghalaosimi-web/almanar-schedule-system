const express = require('express');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../db');

const router = express.Router();

const loadFallbackMetadata = () => {
  try {
    const filePath = path.join(__dirname, '../../data/fallback_metadata.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error('[OFFLINE FALLBACK] Error loading fallback metadata:', err);
  }
  return null;
};

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
    const fallback = loadFallbackMetadata();
    if (fallback) {
      const { slug } = req.query;
      const uni = fallback.universities.find(u => u.slug === slug);
      if (uni) {
        return res.status(200).json({
          success: true,
          data: {
            themeColor: uni.themeColor,
            logoUrl: uni.logoUrl,
            university: uni
          }
        });
      }
      const college = fallback.colleges.find(c => c.slug === slug || (slug === 'almanar-main' && c.id === 3));
      if (college) {
        const pUni = fallback.universities.find(u => u.id === college.universityId);
        return res.status(200).json({
          success: true,
          data: {
            themeColor: pUni ? pUni.themeColor : '#60c4ff',
            logoUrl: pUni ? pUni.logoUrl : null,
            college: {
              ...college,
              university: pUni
            }
          }
        });
      }
    }
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
    const fallback = loadFallbackMetadata();
    if (fallback && fallback.governorates) {
      console.log('[OFFLINE FALLBACK] Served governorates from local filesystem fallback.');
      return res.status(200).json({
        success: true,
        data: fallback.governorates
      });
    }
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
    const fallback = loadFallbackMetadata();
    if (fallback && fallback.universities) {
      console.log('[OFFLINE FALLBACK] Served universities from local filesystem fallback.');
      const filtered = fallback.universities.filter(u => u.governorateId === req.query.govId);
      return res.status(200).json({
        success: true,
        data: filtered
      });
    }
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
    const fallback = loadFallbackMetadata();
    if (fallback && fallback.colleges) {
      console.log('[OFFLINE FALLBACK] Served colleges from local filesystem fallback.');
      const filtered = fallback.colleges.filter(c => c.universityId === parseInt(req.query.uniId));
      return res.status(200).json({
        success: true,
        data: filtered.map(c => ({ id: c.id, name: c.name }))
      });
    }
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
    const fallback = loadFallbackMetadata();
    if (fallback && fallback.majors) {
      console.log('[OFFLINE FALLBACK] Served majors from local filesystem fallback.');
      const list = fallback.majors[req.query.collegeId] || [];
      return res.status(200).json({
        success: true,
        data: list
      });
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Simple in-memory cache to prevent database saturation under high load / stress testing
const schedulesCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// 5. GET /api/public/schedules?collegeId=...&majorId=...
router.get('/schedules', async (req, res) => {
  try {
    const { collegeId, majorId, page, limit } = req.query;
    if (!collegeId) {
      return res.status(400).json({ success: false, error: 'collegeId query parameter is required' });
    }

    const cacheKey = `college_${collegeId}_major_${majorId || 'all'}_page_${page || 'all'}_limit_${limit || 'all'}`;
    let cacheEntry = schedulesCache.get(cacheKey);

    if (!cacheEntry || (Date.now() - cacheEntry.timestamp > CACHE_TTL)) {
      const fetchPromise = (async () => {
        try {
          const whereClause = {
            collegeId: parseInt(collegeId)
          };

          if (majorId) {
            whereClause.group = {
              majorId: parseInt(majorId)
            };
          }

          const p = page ? parseInt(page) : null;
          const l = limit ? parseInt(limit) : null;
          const skip = p && l ? (p - 1) * l : null;

          const dbQueryPromise = (async () => {
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

            return schedules.map(sched => ({
              ...sched,
              attendingGroups: sharesMap.get(sigOf(sched)) ?? []
            }));
          })();

          // Race database operations against a 500ms timeout
          const result = await Promise.race([
            dbQueryPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Database query timeout')), 500))
          ]);

          // Cache successfully loaded data to a local fallback file
          try {
            const fallbackDir = path.join(__dirname, '../../data');
            if (!fs.existsSync(fallbackDir)) {
              fs.mkdirSync(fallbackDir, { recursive: true });
            }
            const fallbackPath = path.join(fallbackDir, `fallback_schedules_${collegeId}_${majorId || 'all'}.json`);
            fs.writeFileSync(fallbackPath, JSON.stringify(result, null, 2));
          } catch (writeErr) {
            console.error('[OFFLINE FALLBACK] Failed to write fallback schedules file:', writeErr);
          }

          return result;
        } catch (dbErr) {
          console.warn('[OFFLINE FALLBACK] Database query failed. Attempting local filesystem fallback...', dbErr.message);
          
          try {
            const fallbackPath = path.join(__dirname, `../../data/fallback_schedules_${collegeId}_${majorId || 'all'}.json`);
            if (fs.existsSync(fallbackPath)) {
              console.log('[OFFLINE FALLBACK] Served schedules from local filesystem fallback.');
              return JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
            }
          } catch (readErr) {
            console.error('[OFFLINE FALLBACK] Failed to read fallback schedules file:', readErr);
          }

          console.warn('[OFFLINE FALLBACK] No local fallback file available. Returning empty array.');
          return [];
        }
      })();

      cacheEntry = {
        timestamp: Date.now(),
        promise: fetchPromise
      };
      schedulesCache.set(cacheKey, cacheEntry);
    }

    try {
      const data = await cacheEntry.promise;
      res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      schedulesCache.delete(cacheKey);
      throw err;
    }
  } catch (error) {
    console.error('[PUBLIC API] Error fetching schedules:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;


