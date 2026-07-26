import { DEVELOPER_EMAILS, ROLES } from './constants';

/**
 * Application permissions with module namespace structure + legacy compatibility.
 * New UI ask this registry instead of comparing raw role strings.
 */
export const PERMISSIONS = Object.freeze({
  // Legacy Flat Action Permissions (Preserved 100% for Backward Compatibility)
  ACCESS_ADMIN_PORTAL: 'ACCESS_ADMIN_PORTAL',
  VIEW_ADMIN_OVERVIEW: 'VIEW_ADMIN_OVERVIEW',
  MANAGE_SCHEDULES: 'MANAGE_SCHEDULES',
  MANAGE_STUDENTS: 'MANAGE_STUDENTS',
  MANAGE_LECTURERS: 'MANAGE_LECTURERS',
  MANAGE_GROUPS: 'MANAGE_GROUPS',
  SEND_BROADCASTS: 'SEND_BROADCASTS',
  VIEW_SYSTEM_LOGS: 'VIEW_SYSTEM_LOGS',
  MANAGE_TENANTS: 'MANAGE_TENANTS',
  ACCESS_DEV_PORTAL: 'ACCESS_DEV_PORTAL',
  ACCESS_STUDENT_PORTAL: 'ACCESS_STUDENT_PORTAL',
  ACCESS_LECTURER_PORTAL: 'ACCESS_LECTURER_PORTAL',

  // Namespaced Granular Module Permissions
  SCHEDULE: Object.freeze({
    VIEW: 'SCHEDULE_VIEW',
    CREATE: 'SCHEDULE_CREATE',
    EDIT: 'SCHEDULE_EDIT',
    DELETE: 'SCHEDULE_DELETE',
    PUBLISH: 'SCHEDULE_PUBLISH',
  }),

  STUDENTS: Object.freeze({
    VIEW: 'STUDENT_VIEW',
    DETAILS: 'STUDENT_DETAILS',
    RESET_PASSWORD: 'STUDENT_RESET_PASSWORD',
    IMPERSONATE: 'STUDENT_IMPERSONATE',
    TOGGLE_REP: 'STUDENT_TOGGLE_REP',
  }),

  LECTURERS: Object.freeze({
    VIEW: 'LECTURER_VIEW',
    MANAGE: 'LECTURER_MANAGE',
  }),

  GROUPS: Object.freeze({
    VIEW: 'GROUP_VIEW',
    MANAGE: 'GROUP_MANAGE',
  }),

  BROADCASTS: Object.freeze({
    VIEW: 'BROADCAST_VIEW',
    SEND: 'BROADCAST_SEND',
  }),

  SYSTEM_LOGS: Object.freeze({
    VIEW: 'SYSTEM_LOGS_VIEW',
  }),

  DEV_PORTAL: Object.freeze({
    ACCESS: 'DEV_PORTAL_ACCESS',
  }),

  TENANTS: Object.freeze({
    MANAGE: 'TENANT_MANAGE',
  }),
});

const ALL_ADMIN_PERMISSIONS = [
  PERMISSIONS.ACCESS_ADMIN_PORTAL,
  PERMISSIONS.VIEW_ADMIN_OVERVIEW,
  PERMISSIONS.MANAGE_SCHEDULES,
  PERMISSIONS.MANAGE_STUDENTS,
  PERMISSIONS.MANAGE_LECTURERS,
  PERMISSIONS.MANAGE_GROUPS,
  PERMISSIONS.SEND_BROADCASTS,
  PERMISSIONS.VIEW_SYSTEM_LOGS,

  PERMISSIONS.SCHEDULE.VIEW,
  PERMISSIONS.SCHEDULE.CREATE,
  PERMISSIONS.SCHEDULE.EDIT,
  PERMISSIONS.SCHEDULE.DELETE,
  PERMISSIONS.SCHEDULE.PUBLISH,

  PERMISSIONS.STUDENTS.VIEW,
  PERMISSIONS.STUDENTS.DETAILS,
  PERMISSIONS.STUDENTS.RESET_PASSWORD,
  PERMISSIONS.STUDENTS.IMPERSONATE,
  PERMISSIONS.STUDENTS.TOGGLE_REP,

  PERMISSIONS.LECTURERS.VIEW,
  PERMISSIONS.LECTURERS.MANAGE,

  PERMISSIONS.GROUPS.VIEW,
  PERMISSIONS.GROUPS.MANAGE,

  PERMISSIONS.BROADCASTS.VIEW,
  PERMISSIONS.BROADCASTS.SEND,

  PERMISSIONS.SYSTEM_LOGS.VIEW,
];

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.SUPER_ADMIN]: [
    ...ALL_ADMIN_PERMISSIONS,
    PERMISSIONS.MANAGE_TENANTS,
    PERMISSIONS.ACCESS_DEV_PORTAL,
    PERMISSIONS.DEV_PORTAL.ACCESS,
    PERMISSIONS.TENANTS.MANAGE,
  ],
  [ROLES.UNI_ADMIN]: ALL_ADMIN_PERMISSIONS,
  [ROLES.COLLEGE_ADMIN]: ALL_ADMIN_PERMISSIONS,
  [ROLES.ADMIN]: ALL_ADMIN_PERMISSIONS,
  [ROLES.LECTURER]: [
    PERMISSIONS.ACCESS_LECTURER_PORTAL,
    PERMISSIONS.SCHEDULE.VIEW,
    PERMISSIONS.STUDENTS.VIEW,
  ],
  [ROLES.STUDENT]: [
    PERMISSIONS.ACCESS_STUDENT_PORTAL,
    PERMISSIONS.SCHEDULE.VIEW,
  ],
});

export function hasPermission(user, permission) {
  if (!user || !permission) return false;
  const permStr = typeof permission === 'string' ? permission : String(permission);
  if (!permStr) return false;

  const email = user.email?.trim().toLowerCase();
  if (email && DEVELOPER_EMAILS.includes(email)) return true;

  const userPerms = getPermissions(user);
  if (userPerms.includes(permStr)) return true;

  // Backward compatibility alias checks
  if ((permStr === PERMISSIONS.SCHEDULE.VIEW || permStr === PERMISSIONS.SCHEDULE.EDIT) && userPerms.includes(PERMISSIONS.MANAGE_SCHEDULES)) {
    return true;
  }
  if (permStr === PERMISSIONS.BROADCASTS.SEND && userPerms.includes(PERMISSIONS.SEND_BROADCASTS)) {
    return true;
  }
  if ((permStr === PERMISSIONS.STUDENTS.VIEW || permStr === PERMISSIONS.STUDENTS.DETAILS) && userPerms.includes(PERMISSIONS.MANAGE_STUDENTS)) {
    return true;
  }
  if (permStr === PERMISSIONS.DEV_PORTAL.ACCESS && userPerms.includes(PERMISSIONS.ACCESS_DEV_PORTAL)) {
    return true;
  }

  return false;
}

export function hasAnyPermission(user, permissions = []) {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function getPermissions(user) {
  if (!user) return [];
  const email = user.email?.trim().toLowerCase();
  if (email && DEVELOPER_EMAILS.includes(email)) {
    return [
      ...Object.values(PERMISSIONS).filter((p) => typeof p === 'string'),
      ...Object.values(PERMISSIONS.SCHEDULE),
      ...Object.values(PERMISSIONS.STUDENTS),
      ...Object.values(PERMISSIONS.LECTURERS),
      ...Object.values(PERMISSIONS.GROUPS),
      ...Object.values(PERMISSIONS.BROADCASTS),
      ...Object.values(PERMISSIONS.SYSTEM_LOGS),
      ...Object.values(PERMISSIONS.DEV_PORTAL),
      ...Object.values(PERMISSIONS.TENANTS),
    ];
  }
  return ROLE_PERMISSIONS[user.role] ?? [];
}

