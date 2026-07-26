import { hasPermission, PERMISSIONS } from './permissionRegistry';

const ARABIC_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export function normalizeSearchText(value = '') {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(ARABIC_MARKS, '')
    .replace(/[أإآءؤئ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function detectEntityType(entity) {
  if (!entity) return 'Entity';
  if (entity.idNumber !== undefined || entity.isRepresentative !== undefined || entity.groupId !== undefined) return 'Student';
  if (entity.specialty !== undefined || entity.isLecturer || (entity.email && entity.email.includes('lecturer'))) return 'Lecturer';
  if (entity.majorId !== undefined || (entity.name && entity.name.match(/(مجموعة|شعبة|Group)/i))) return 'Group';
  if (entity.departmentId !== undefined || (entity.code && String(entity.code).startsWith('MAJ'))) return 'Major';
  if (entity.levelNumber !== undefined || (entity.name && entity.name.match(/(المستوى|Level)/i))) return 'Level';
  if (entity.courses !== undefined || (entity.code && String(entity.code).startsWith('DEP'))) return 'Department';
  if (entity.credits !== undefined || entity.subject !== undefined) return 'Course';
  return 'Entity';
}

export function createSearchIndex(entities = []) {
  const records = entities.filter(Boolean).map((entity) => {
    const type = entity._type || detectEntityType(entity);
    const id = entity.id ?? entity.code ?? '';
    const name = entity.name || entity.arabicName || entity.title || '';
    const englishName = entity.englishName || entity.nameEn || '';
    const code = entity.code || '';
    const idNumber = entity.idNumber || '';
    const department = entity.department?.name || entity.major?.department?.name || entity.group?.major?.department?.name || '';
    const level = entity.level?.name || entity.group?.level?.name || '';
    const group = entity.group?.name || '';

    const textToSearch = [
      type,
      id,
      name,
      englishName,
      code,
      idNumber,
      department,
      level,
      group,
      entity.email,
      entity.phone,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      type,
      id,
      name,
      englishName,
      code,
      idNumber,
      department,
      level,
      group,
      entity,
      text: normalizeSearchText(textToSearch),
    };
  });

  return Object.freeze({
    search(query, limit = 20, user = null) {
      const tokens = normalizeSearchText(query).split(' ').filter(Boolean);
      if (!tokens.length) return [];

      return records
        .filter(({ type, text }) => {
          // Pre-rendering Security Gate
          if (user) {
            if (type === 'Student' && !hasPermission(user, PERMISSIONS.STUDENTS.VIEW) && user.role !== 'STUDENT') return false;
            if (type === 'Lecturer' && !hasPermission(user, PERMISSIONS.LECTURERS.VIEW) && user.role !== 'LECTURER') return false;
            if (type === 'System' && !hasPermission(user, PERMISSIONS.VIEW_SYSTEM_LOGS)) return false;
          }
          return tokens.every((token) => text.includes(token));
        })
        .slice(0, limit);
    },
    size: records.length,
  });
}


