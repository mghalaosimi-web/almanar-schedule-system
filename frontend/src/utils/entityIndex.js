const keyOf = (value) => String(value ?? '');

export const createIdIndex = (entities = []) =>
  new Map(entities.filter(Boolean).map((entity) => [keyOf(entity.id ?? entity.code), entity]));

/**
 * Keeps all lookup maps in one immutable snapshot.
 * UI can perform O(1) lookups without repeated Array.find or Array.filter.
 */
export function createEntityIndex({
  students = [],
  lecturers = [],
  groups = [],
  majors = [],
  departments = [],
  levels = [],
  courses = [],
  colleges = [],
  universities = [],
} = {}) {
  const studentsById = createIdIndex(students);
  const lecturersById = createIdIndex(lecturers);
  const groupsById = createIdIndex(groups);
  const majorsById = createIdIndex(majors);
  const departmentsById = createIdIndex(departments);
  const levelsById = createIdIndex(levels);
  const coursesById = createIdIndex(courses);
  const collegesById = createIdIndex(colleges);
  const universitiesById = createIdIndex(universities);

  // Relational Maps
  const groupsByMajorId = new Map();
  const groupsByDepartmentId = new Map();
  const majorsByDepartmentId = new Map();
  const studentsByGroupId = new Map();
  const studentsByMajorId = new Map();
  const studentsByLevelId = new Map();
  const studentsByDepartmentId = new Map();

  majors.forEach((major) => {
    const deptId = keyOf(major.departmentId ?? major.department?.id);
    if (deptId) {
      if (!majorsByDepartmentId.has(deptId)) majorsByDepartmentId.set(deptId, []);
      majorsByDepartmentId.get(deptId).push(major);
    }
  });

  groups.forEach((group) => {
    const majorId = keyOf(group.majorId ?? group.major?.id);
    if (majorId) {
      if (!groupsByMajorId.has(majorId)) groupsByMajorId.set(majorId, []);
      groupsByMajorId.get(majorId).push(group);
    }
    const deptId = keyOf(group.departmentId ?? group.department?.id ?? group.major?.departmentId ?? group.major?.department?.id);
    if (deptId) {
      if (!groupsByDepartmentId.has(deptId)) groupsByDepartmentId.set(deptId, []);
      groupsByDepartmentId.get(deptId).push(group);
    }
  });

  students.forEach((student) => {
    const groupId = keyOf(student.groupId ?? student.group?.id);
    if (groupId) {
      if (!studentsByGroupId.has(groupId)) studentsByGroupId.set(groupId, []);
      studentsByGroupId.get(groupId).push(student);
    }
    const majorId = keyOf(student.majorId ?? student.major?.id ?? student.group?.majorId ?? student.group?.major?.id);
    if (majorId) {
      if (!studentsByMajorId.has(majorId)) studentsByMajorId.set(majorId, []);
      studentsByMajorId.get(majorId).push(student);
    }
    const levelId = keyOf(student.levelId ?? student.level?.id ?? student.group?.levelId ?? student.group?.level?.id);
    if (levelId) {
      if (!studentsByLevelId.has(levelId)) studentsByLevelId.set(levelId, []);
      studentsByLevelId.get(levelId).push(student);
    }
    const deptId = keyOf(
      student.departmentId ??
      student.department?.id ??
      student.major?.departmentId ??
      student.major?.department?.id ??
      student.group?.major?.departmentId ??
      student.group?.major?.department?.id
    );
    if (deptId) {
      if (!studentsByDepartmentId.has(deptId)) studentsByDepartmentId.set(deptId, []);
      studentsByDepartmentId.get(deptId).push(student);
    }
  });

  const getStudentById = (id) => studentsById.get(keyOf(id)) ?? null;
  const getLecturerById = (id) => lecturersById.get(keyOf(id)) ?? null;
  const getGroupById = (id) => groupsById.get(keyOf(id)) ?? null;
  const getMajorById = (id) => majorsById.get(keyOf(id)) ?? null;
  const getDepartmentById = (id) => departmentsById.get(keyOf(id)) ?? null;
  const getLevelById = (id) => levelsById.get(keyOf(id)) ?? null;
  const getCourseById = (id) => coursesById.get(keyOf(id)) ?? null;

  const getById = (type, id) => {
    if (!type || id == null) return null;
    const normalizedType = String(type).toLowerCase().replace(/s$/, '');
    switch (normalizedType) {
      case 'student': return getStudentById(id);
      case 'lecturer': return getLecturerById(id);
      case 'group': return getGroupById(id);
      case 'major': return getMajorById(id);
      case 'department': return getDepartmentById(id);
      case 'level': return getLevelById(id);
      case 'course': return getCourseById(id);
      case 'college': return collegesById.get(keyOf(id)) ?? null;
      case 'university': return universitiesById.get(keyOf(id)) ?? null;
      default: return null;
    }
  };

  const getByGroup = (groupId) => studentsByGroupId.get(keyOf(groupId)) ?? [];
  const getByMajor = (majorId) => groupsByMajorId.get(keyOf(majorId)) ?? [];
  const getByDepartment = (deptId) => groupsByDepartmentId.get(keyOf(deptId)) ?? majorsByDepartmentId.get(keyOf(deptId)) ?? [];
  const getByLevel = (levelId) => studentsByLevelId.get(keyOf(levelId)) ?? [];

  return Object.freeze({
    studentsById,
    lecturersById,
    groupsById,
    majorsById,
    departmentsById,
    levelsById,
    coursesById,
    collegesById,
    universitiesById,
    groupsByMajorId,
    groupsByDepartmentId,
    majorsByDepartmentId,
    studentsByGroupId,
    studentsByMajorId,
    studentsByLevelId,
    studentsByDepartmentId,
    getStudentById,
    getLecturerById,
    getGroupById,
    getMajorById,
    getDepartmentById,
    getLevelById,
    getCourseById,
    getById,
    getGroupStudents: getByGroup,
    getMajorGroups: getByMajor,
    getDepartmentGroups: (deptId) => groupsByDepartmentId.get(keyOf(deptId)) ?? [],
    getDepartmentMajors: (deptId) => majorsByDepartmentId.get(keyOf(deptId)) ?? [],
    getDepartmentStudents: (deptId) => studentsByDepartmentId.get(keyOf(deptId)) ?? [],
    getMajorStudents: (majorId) => studentsByMajorId.get(keyOf(majorId)) ?? [],
    getLevelStudents: (levelId) => studentsByLevelId.get(keyOf(levelId)) ?? [],
    getByGroup,
    getByMajor,
    getByDepartment,
    getByLevel,
  });
}

