import { createEntityIndex } from './entityIndex';

export const AUDIENCE_TYPES = Object.freeze({
  ALL_COLLEGE: 'ALL_COLLEGE',
  UNIVERSITY: 'UNIVERSITY',
  COLLEGE: 'COLLEGE',
  MAJOR: 'MAJOR',
  LEVEL: 'LEVEL',
  GROUP: 'GROUP',
  INDIVIDUAL_STUDENT: 'INDIVIDUAL_STUDENT',
  LECTURER: 'LECTURER',
});

const idEquals = (left, right) => String(left ?? '') === String(right ?? '');

/** Resolves a target into a human-readable audience plus its exact recipients and metadata snapshot. */
export function resolveAudience({
  type,
  id,
  students = [],
  lecturers = [],
  groups = [],
  majors = [],
  levels = [],
  departments = [],
  colleges = [],
  universities = [],
}) {
  const index = createEntityIndex({ students, lecturers, groups, majors, levels, departments, colleges, universities });
  let recipients = [];
  let entity = null;
  let humanReadable = {
    title: '',
    departmentName: '',
    majorName: '',
    levelName: '',
    groupName: '',
    formattedSummary: '',
  };

  switch (type) {
    case AUDIENCE_TYPES.GROUP:
      entity = index.getGroupById(id);
      recipients = index.getByGroup(id);
      if (!recipients.length && id) {
        recipients = students.filter((s) => idEquals(s.groupId ?? s.group?.id, id));
      }
      humanReadable.groupName = entity?.name || `المجموعة ${id || ''}`.trim();
      humanReadable.majorName = entity?.major?.name || index.getMajorById(entity?.majorId)?.name || '';
      humanReadable.departmentName =
        entity?.major?.department?.name ||
        entity?.department?.name ||
        index.getDepartmentById(entity?.departmentId)?.name ||
        '';
      humanReadable.levelName = entity?.level?.name || index.getLevelById(entity?.levelId)?.name || '';
      humanReadable.title = `المجموعة: ${humanReadable.groupName}`;
      break;

    case AUDIENCE_TYPES.MAJOR:
      entity = index.getMajorById(id);
      recipients = index.getMajorStudents(id);
      if (!recipients.length && id) {
        recipients = students.filter((s) => idEquals(s.majorId ?? s.major?.id ?? s.group?.majorId, id));
      }
      humanReadable.majorName = entity?.name || `التخصص ${id || ''}`.trim();
      humanReadable.departmentName = entity?.department?.name || index.getDepartmentById(entity?.departmentId)?.name || '';
      humanReadable.title = `التخصص: ${humanReadable.majorName}`;
      break;

    case AUDIENCE_TYPES.LEVEL:
      entity = index.getLevelById(id);
      recipients = index.getLevelStudents(id);
      if (!recipients.length && id) {
        recipients = students.filter((s) => idEquals(s.levelId ?? s.level?.id ?? s.group?.levelId, id));
      }
      humanReadable.levelName = entity?.name || `المستوى ${id || ''}`.trim();
      humanReadable.title = `المستوى: ${humanReadable.levelName}`;
      break;

    case AUDIENCE_TYPES.COLLEGE:
    case AUDIENCE_TYPES.ALL_COLLEGE:
      entity = index.collegesById.get(String(id ?? ''));
      recipients = students.filter((s) => !id || idEquals(s.collegeId ?? s.group?.collegeId, id));
      humanReadable.title = entity?.name ? `كلية: ${entity.name}` : 'جميع طلاب الكلية';
      break;

    case AUDIENCE_TYPES.UNIVERSITY:
      entity = index.universitiesById.get(String(id ?? ''));
      recipients = students.filter((s) => idEquals(s.universityId ?? s.college?.universityId ?? s.group?.college?.universityId, id));
      humanReadable.title = entity?.name ? `جامعة: ${entity.name}` : 'جميع منسوبي الجامعة';
      break;

    case AUDIENCE_TYPES.INDIVIDUAL_STUDENT:
      entity = index.getStudentById(id);
      recipients = entity ? [entity] : [];
      humanReadable.title = entity?.name ? `الطالب: ${entity.name}` : `طالب ID: ${id}`;
      humanReadable.groupName = entity?.group?.name || '';
      humanReadable.majorName = entity?.major?.name || '';
      humanReadable.departmentName = entity?.major?.department?.name || entity?.department?.name || '';
      humanReadable.levelName = entity?.level?.name || '';
      break;

    case AUDIENCE_TYPES.LECTURER:
      entity = index.getLecturerById(id);
      recipients = entity ? [entity] : [];
      humanReadable.title = entity?.name ? `المحاضر: ${entity.name}` : `محاضر ID: ${id}`;
      humanReadable.departmentName = entity?.department?.name || '';
      break;

    default:
      recipients = students;
      humanReadable.title = 'جميع الطلاب والمستهدفين';
  }

  const metaParts = [
    humanReadable.departmentName ? `القسم: ${humanReadable.departmentName}` : null,
    humanReadable.majorName ? `التخصص: ${humanReadable.majorName}` : null,
    humanReadable.levelName ? `المستوى: ${humanReadable.levelName}` : null,
    humanReadable.groupName ? `المجموعة: ${humanReadable.groupName}` : null,
  ].filter(Boolean);

  humanReadable.formattedSummary = metaParts.length > 0 ? metaParts.join(' · ') : humanReadable.title;

  return {
    type,
    id,
    entity,
    recipients,
    count: recipients.length,
    humanReadable,
    index,
  };
}

