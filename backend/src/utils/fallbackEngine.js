/**
 * @file fallbackEngine.js
 * @description محرك استعلام محلي بديل للملفات عند انقطاع الاتصال بقاعدة البيانات.
 */

const fs = require('fs');
const path = require('path');

const METADATA_FILE = path.join(__dirname, '../../data/fallback_metadata.json');
const DATA_DIR = path.join(__dirname, '../../data');

function loadMetadata() {
  if (fs.existsSync(METADATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    } catch (e) {
      console.error('[FallbackEngine] Failed to parse metadata file:', e);
    }
  }
  return { governorates: [], universities: [], colleges: [], majors: {}, users: { admins: [], lecturers: [], students: [] } };
}

function saveMetadata(data) {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[FallbackEngine] Failed to save metadata file:', e);
  }
}

function loadAllSchedules() {
  const schedules = [];
  try {
    if (!fs.existsSync(DATA_DIR)) return [];
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.startsWith('fallback_schedules_') && file.endsWith('.json')) {
        const filePath = path.join(DATA_DIR, file);
        try {
          const fileSchedules = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (Array.isArray(fileSchedules)) {
            schedules.push(...fileSchedules);
          }
        } catch (e) {
          console.error(`[FallbackEngine] Failed to parse schedules file ${file}:`, e);
        }
      }
    }
  } catch (e) {
    console.error('[FallbackEngine] Failed to read schedules directory:', e);
  }
  return schedules;
}

function getRooms(schedules) {
  const map = new Map();
  schedules.forEach(s => {
    if (s.room) {
      map.set(s.room.id, { ...s.room, collegeId: s.collegeId });
    } else if (s.roomId) {
      map.set(s.roomId, { id: s.roomId, name: `قاعة ${s.roomId}`, capacity: 50, collegeId: s.collegeId });
    }
  });
  return Array.from(map.values());
}

function getSubjects(schedules) {
  const map = new Map();
  schedules.forEach(s => {
    if (s.subject) {
      map.set(s.subject.id, { ...s.subject, collegeId: s.collegeId });
    }
  });
  return Array.from(map.values());
}

function getGroups(schedules) {
  const map = new Map();
  schedules.forEach(s => {
    if (s.group) {
      map.set(s.group.id, { ...s.group, collegeId: s.collegeId });
    }
  });
  return Array.from(map.values());
}

function getLevels(schedules) {
  const map = new Map();
  schedules.forEach(s => {
    if (s.group && s.group.level) {
      map.set(s.group.level.id, s.group.level);
    }
  });
  if (map.size === 0) {
    return [
      { id: 1, name: 'المستوى الأول' },
      { id: 2, name: 'المستوى الثاني' },
      { id: 3, name: 'المستوى الثالث' },
      { id: 4, name: 'المستوى الرابع' }
    ];
  }
  return Array.from(map.values());
}

function loadEntityList(entityName, extractFn) {
  const filePath = path.join(DATA_DIR, `fallback_${entityName}.json`);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`[FallbackEngine] Failed to read ${entityName} file:`, e);
    }
  }
  const extracted = extractFn(loadAllSchedules());
  try {
    fs.writeFileSync(filePath, JSON.stringify(extracted, null, 2), 'utf8');
  } catch {}
  return extracted;
}

function saveEntityList(entityName, data) {
  const filePath = path.join(DATA_DIR, `fallback_${entityName}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`[FallbackEngine] Failed to save ${entityName} file:`, e);
  }
}

function loadLogs(type) {
  const filePath = path.join(DATA_DIR, `fallback_${type}_logs.json`);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`[FallbackEngine] Failed to read ${type} logs:`, e);
    }
  }
  return [];
}

function saveLogs(type, data) {
  const filePath = path.join(DATA_DIR, `fallback_${type}_logs.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`[FallbackEngine] Failed to save ${type} logs:`, e);
  }
}

function getListForModel(modelName, meta, schedules) {
  const norm = modelName.toLowerCase();
  if (norm === 'student') return meta.users?.students || [];
  if (norm === 'lecturer') return meta.users?.lecturers || [];
  if (norm === 'admin') return meta.users?.admins || [];
  if (norm === 'governorate') return meta.governorates || [];
  if (norm === 'university') return meta.universities || [];
  if (norm === 'college') return meta.colleges || [];
  if (norm === 'major') {
    const list = [];
    for (const [colId, majors] of Object.entries(meta.majors || {})) {
      majors.forEach(m => list.push({ ...m, collegeId: parseInt(colId) }));
    }
    return list;
  }
  if (norm === 'room') return loadEntityList('rooms', getRooms);
  if (norm === 'subject') return loadEntityList('subjects', getSubjects);
  if (norm === 'group') return loadEntityList('groups', getGroups);
  if (norm === 'level') return loadEntityList('levels', getLevels);
  if (norm === 'schedule') return schedules;
  if (norm === 'tenantconfig') {
    const configs = [];
    meta.universities.forEach(u => {
      configs.push({
        id: u.id,
        universityId: u.id,
        collegeId: null,
        themeColor: u.themeColor || '#60c4ff',
        logoUrl: u.logoUrl,
        enabledFeatures: { qrAttendance: true, notifications: true }
      });
    });
    meta.colleges.forEach(c => {
      configs.push({
        id: 100 + c.id,
        universityId: null,
        collegeId: c.id,
        themeColor: '#059669',
        logoUrl: null,
        enabledFeatures: { qrAttendance: true, notifications: true }
      });
    });
    return configs;
  }
  if (norm === 'sessionlog') return loadLogs('session');
  if (norm === 'auditlog') return loadLogs('audit');
  if (norm === 'notificationlog') return loadLogs('notification');
  if (norm === 'reschedulerequest') return loadLogs('reschedule_request');
  return [];
}

function populateRelations(modelName, items, meta, schedules) {
  const norm = modelName.toLowerCase();
  
  const getCol = (id) => (meta.colleges || []).find(c => c.id === id);
  const getUni = (id) => (meta.universities || []).find(u => u.id === id);
  const getMaj = (id) => {
    for (const [colId, list] of Object.entries(meta.majors || {})) {
      const found = list.find(m => m.id === id);
      if (found) return { ...found, collegeId: parseInt(colId) };
    }
    return null;
  };
  const getLvl = (id) => loadEntityList('levels', getLevels).find(l => l.id === id);
  const getGrp = (id) => loadEntityList('groups', getGroups).find(g => g.id === id);
  const getRoom = (id) => loadEntityList('rooms', getRooms).find(r => r.id === id);
  const getSubj = (id) => loadEntityList('subjects', getSubjects).find(s => s.id === id);
  const getLect = (id) => (meta.users?.lecturers || []).find(l => l.id === id);

  return items.map(item => {
    const clone = { ...item };
    if (norm === 'student') {
      if (clone.collegeId) clone.college = getCol(clone.collegeId);
      if (clone.college?.universityId) clone.college.university = getUni(clone.college.universityId);
      if (clone.majorId) clone.major = getMaj(clone.majorId);
      if (clone.groupId) clone.group = getGrp(clone.groupId);
      if (clone.levelId) clone.level = getLvl(clone.levelId);
    } else if (norm === 'lecturer') {
      if (clone.collegeId) clone.college = getCol(clone.collegeId);
      if (clone.college?.universityId) clone.college.university = getUni(clone.college.universityId);
    } else if (norm === 'college') {
      if (clone.universityId) clone.university = getUni(clone.universityId);
    } else if (norm === 'major') {
      clone.department = { id: 1, collegeId: clone.collegeId, name: 'القسم العام', college: getCol(clone.collegeId) };
    } else if (norm === 'group') {
      if (clone.majorId) clone.major = getMaj(clone.majorId);
      if (clone.levelId) clone.level = getLvl(clone.levelId);
      if (clone.collegeId) clone.college = getCol(clone.collegeId);
    } else if (norm === 'schedule') {
      if (clone.subjectId) clone.subject = getSubj(clone.subjectId);
      if (clone.roomId) clone.room = getRoom(clone.roomId);
      if (clone.groupId) clone.group = getGrp(clone.groupId);
      if (clone.group?.majorId) clone.group.major = getMaj(clone.group.majorId);
      if (clone.group?.levelId) clone.group.level = getLvl(clone.group.levelId);
      if (clone.lecturerId) clone.lecturer = getLect(clone.lecturerId);
      clone.overrides = clone.overrides || [];
      clone.attendingGroups = clone.attendingGroups || [];
    }
    return clone;
  });
}

function matchesCriteria(item, where) {
  if (!where) return true;
  for (const [key, criteria] of Object.entries(where)) {
    if (criteria === undefined) continue;
    if (key === 'OR' && Array.isArray(criteria)) {
      let matchesOr = false;
      for (const cond of criteria) {
        if (matchesCriteria(item, cond)) {
          matchesOr = true;
          break;
        }
      }
      if (!matchesOr) return false;
      continue;
    }
    if (criteria === null) {
      if (item[key] !== null && item[key] !== undefined) return false;
      continue;
    }
    if (typeof criteria === 'object' && !(criteria instanceof Date)) {
      if (criteria.in) {
        if (!criteria.in.includes(item[key])) return false;
      } else if (criteria.notIn) {
        if (criteria.notIn.includes(item[key])) return false;
      } else if (criteria.contains) {
        const itemVal = String(item[key] || '').toLowerCase();
        const searchVal = String(criteria.contains).toLowerCase();
        if (!itemVal.includes(searchVal)) return false;
      } else if (criteria.mode === 'insensitive' && criteria.contains) {
        const itemVal = String(item[key] || '').toLowerCase();
        const searchVal = String(criteria.contains).toLowerCase();
        if (!itemVal.includes(searchVal)) return false;
      } else if (criteria.gte !== undefined) {
        if (item[key] < criteria.gte) return false;
      } else if (criteria.lte !== undefined) {
        if (item[key] > criteria.lte) return false;
      } else if (criteria.gt !== undefined) {
        if (item[key] <= criteria.gt) return false;
      } else if (criteria.lt !== undefined) {
        if (item[key] >= criteria.lt) return false;
      } else if (criteria.not !== undefined) {
        if (item[key] === criteria.not) return false;
      } else {
        if (!item[key] || !matchesCriteria(item[key], criteria)) return false;
      }
    } else {
      if (item[key] !== criteria) return false;
    }
  }
  return true;
}


async function execute(modelName, action, args = {}) {
  const norm = modelName.toLowerCase();
  
  if (['create', 'createmany', 'update', 'updatemany', 'delete', 'deletemany'].includes(action.toLowerCase())) {
    return executeWrite(modelName, action, args);
  }

  const meta = loadMetadata();
  const schedules = loadAllSchedules();
  let list = getListForModel(modelName, meta, schedules);

  // Auto-populate relations
  list = populateRelations(modelName, list, meta, schedules);

  // Apply filtering
  let filtered = list.filter(item => matchesCriteria(item, args.where));

  // Handle orderBy
  if (args.orderBy) {
    const key = Object.keys(args.orderBy)[0];
    const order = args.orderBy[key].toLowerCase();
    filtered.sort((a, b) => {
      const aVal = a[key] || '';
      const bVal = b[key] || '';
      if (order === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }

  if (action === 'findMany') {
    const skip = args.skip || 0;
    const take = args.take;
    if (take !== undefined) {
      return filtered.slice(skip, skip + take);
    }
    return filtered.slice(skip);
  }

  if (action === 'findFirst' || action === 'findUnique') {
    return filtered[0] || null;
  }

  if (action === 'count') {
    return filtered.length;
  }

  if (action === 'groupBy') {
    // Basic support for groupBy used in system metrics
    const byFields = args.by || [];
    const groupsMap = new Map();
    filtered.forEach(item => {
      const key = byFields.map(f => item[f]).join('|');
      const current = groupsMap.get(key) || { _count: { id: 0 }, status: item.status };
      current._count.id++;
      groupsMap.set(key, current);
    });
    return Array.from(groupsMap.values());
  }

  return filtered;
}

function executeWrite(modelName, action, args) {
  const norm = modelName.toLowerCase();
  const meta = loadMetadata();
  let schedules = loadAllSchedules();

  if (action === 'create' || action === 'createMany') {
    const data = args.data || {};
    const id = data.id || Math.floor(Math.random() * 1000000) + 1;
    const newRecord = { id, createdAt: new Date().toISOString(), ...data };

    if (norm === 'student') {
      meta.users = meta.users || {};
      meta.users.students = meta.users.students || [];
      meta.users.students.push(newRecord);
      saveMetadata(meta);
    } else if (norm === 'lecturer') {
      meta.users = meta.users || {};
      meta.users.lecturers = meta.users.lecturers || [];
      meta.users.lecturers.push(newRecord);
      saveMetadata(meta);
    } else if (norm === 'admin') {
      meta.users = meta.users || {};
      meta.users.admins = meta.users.admins || [];
      meta.users.admins.push(newRecord);
      saveMetadata(meta);
    } else if (norm === 'governorate') {
      meta.governorates = meta.governorates || [];
      meta.governorates.push(newRecord);
      saveMetadata(meta);
    } else if (norm === 'university') {
      meta.universities = meta.universities || [];
      meta.universities.push(newRecord);
      saveMetadata(meta);
    } else if (norm === 'college') {
      meta.colleges = meta.colleges || [];
      meta.colleges.push(newRecord);
      saveMetadata(meta);
    } else if (norm === 'major') {
      meta.majors = meta.majors || {};
      const colId = String(data.collegeId || 3);
      meta.majors[colId] = meta.majors[colId] || [];
      meta.majors[colId].push(newRecord);
      saveMetadata(meta);
    } else if (norm === 'room') {
      const list = loadEntityList('rooms', getRooms);
      list.push(newRecord);
      saveEntityList('rooms', list);
    } else if (norm === 'subject') {
      const list = loadEntityList('subjects', getSubjects);
      list.push(newRecord);
      saveEntityList('subjects', list);
    } else if (norm === 'group') {
      const list = loadEntityList('groups', getGroups);
      list.push(newRecord);
      saveEntityList('groups', list);
    } else if (norm === 'level') {
      const list = loadEntityList('levels', getLevels);
      list.push(newRecord);
      saveEntityList('levels', list);
    } else if (norm === 'schedule') {
      const colId = data.collegeId || 3;
      const filePath = path.join(DATA_DIR, `fallback_schedules_${colId}_all.json`);
      let list = [];
      if (fs.existsSync(filePath)) {
        try {
          list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch {}
      }
      list.push(newRecord);
      fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
    } else if (['sessionlog', 'auditlog', 'notificationlog', 'reschedulerequest'].includes(norm)) {
      const type = norm.replace('log', '').replace('request', '_request');
      const list = loadLogs(type);
      list.push(newRecord);
      saveLogs(type, list);
    }
    return newRecord;
  }

  if (action === 'update' || action === 'updateMany') {
    const where = args.where || {};
    const data = args.data || {};

    if (norm === 'student') {
      meta.users.students = (meta.users.students || []).map(item => {
        if (matchesCriteria(item, where)) {
          return { ...item, ...data };
        }
        return item;
      });
      saveMetadata(meta);
      return meta.users.students.find(item => matchesCriteria(item, where));
    } else if (norm === 'lecturer') {
      meta.users.lecturers = (meta.users.lecturers || []).map(item => {
        if (matchesCriteria(item, where)) {
          return { ...item, ...data };
        }
        return item;
      });
      saveMetadata(meta);
      return meta.users.lecturers.find(item => matchesCriteria(item, where));
    } else if (norm === 'room') {
      const list = loadEntityList('rooms', getRooms).map(item => {
        if (matchesCriteria(item, where)) {
          return { ...item, ...data };
        }
        return item;
      });
      saveEntityList('rooms', list);
      return list.find(item => matchesCriteria(item, where));
    } else if (norm === 'major') {
      let updated = null;
      for (const [colId, list] of Object.entries(meta.majors || {})) {
        meta.majors[colId] = list.map(item => {
          if (matchesCriteria({ ...item, collegeId: parseInt(colId) }, where)) {
            updated = { ...item, ...data };
            return updated;
          }
          return item;
        });
      }
      saveMetadata(meta);
      return updated;
    }
  }

  if (action === 'delete' || action === 'deleteMany') {
    const where = args.where || {};

    if (norm === 'student') {
      meta.users.students = (meta.users.students || []).filter(item => !matchesCriteria(item, where));
      saveMetadata(meta);
      return { success: true };
    } else if (norm === 'lecturer') {
      meta.users.lecturers = (meta.users.lecturers || []).filter(item => !matchesCriteria(item, where));
      saveMetadata(meta);
      return { success: true };
    } else if (norm === 'room') {
      const list = loadEntityList('rooms', getRooms).filter(item => !matchesCriteria(item, where));
      saveEntityList('rooms', list);
      return { success: true };
    } else if (norm === 'major') {
      for (const [colId, list] of Object.entries(meta.majors || {})) {
        meta.majors[colId] = list.filter(item => !matchesCriteria({ ...item, collegeId: parseInt(colId) }, where));
      }
      saveMetadata(meta);
      return { success: true };
    } else if (norm === 'group') {
      const list = loadEntityList('groups', getGroups).filter(item => !matchesCriteria(item, where));
      saveEntityList('groups', list);
      return { success: true };
    }
  }

  return null;
}

module.exports = {
  execute
};
