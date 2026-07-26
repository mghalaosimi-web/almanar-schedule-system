const DEVELOPER_EMAILS = [
  'developer@mghal.com',
  'm.gh.alosimi@gmail.com'
];

const PERMISSIONS = {
  // Schedules
  MANAGE_SCHEDULES: 'MANAGE_SCHEDULES',
  SCHEDULE_VIEW: 'SCHEDULE_VIEW',
  SCHEDULE_CREATE: 'SCHEDULE_CREATE',
  SCHEDULE_EDIT: 'SCHEDULE_EDIT',
  SCHEDULE_DELETE: 'SCHEDULE_DELETE',
  SCHEDULE_PUBLISH: 'SCHEDULE_PUBLISH',

  // Students
  MANAGE_STUDENTS: 'MANAGE_STUDENTS',
  STUDENT_VIEW: 'STUDENT_VIEW',
  STUDENT_DETAILS: 'STUDENT_DETAILS',
  STUDENT_RESET_PASSWORD: 'STUDENT_RESET_PASSWORD',
  STUDENT_IMPERSONATE: 'STUDENT_IMPERSONATE',
  STUDENT_TOGGLE_REP: 'STUDENT_TOGGLE_REP',

  // Lecturers
  MANAGE_LECTURERS: 'MANAGE_LECTURERS',
  LECTURER_VIEW: 'LECTURER_VIEW',
  LECTURER_MANAGE: 'LECTURER_MANAGE',

  // Groups
  MANAGE_GROUPS: 'MANAGE_GROUPS',
  GROUP_VIEW: 'GROUP_VIEW',
  GROUP_MANAGE: 'GROUP_MANAGE',

  // Broadcasts
  SEND_BROADCASTS: 'SEND_BROADCASTS',
  BROADCAST_VIEW: 'BROADCAST_VIEW',
  BROADCAST_SEND: 'BROADCAST_SEND',

  // System Logs & Audit
  VIEW_SYSTEM_LOGS: 'VIEW_SYSTEM_LOGS',
  SYSTEM_LOGS_VIEW: 'SYSTEM_LOGS_VIEW',
  AUDIT_LOGS_VIEW: 'AUDIT_LOGS_VIEW',

  // Tenants & Developer
  MANAGE_TENANTS: 'MANAGE_TENANTS',
  TENANT_MANAGE: 'TENANT_MANAGE',
  ACCESS_DEV_PORTAL: 'ACCESS_DEV_PORTAL',
  DEV_PORTAL_ACCESS: 'DEV_PORTAL_ACCESS',

  // Search & Analytics
  SEARCH_VIEW: 'SEARCH_VIEW',
  ANALYTICS_VIEW: 'ANALYTICS_VIEW'
};

const ALL_ADMIN_PERMISSIONS = [
  PERMISSIONS.MANAGE_SCHEDULES,
  PERMISSIONS.SCHEDULE_VIEW,
  PERMISSIONS.SCHEDULE_CREATE,
  PERMISSIONS.SCHEDULE_EDIT,
  PERMISSIONS.SCHEDULE_DELETE,
  PERMISSIONS.SCHEDULE_PUBLISH,

  PERMISSIONS.MANAGE_STUDENTS,
  PERMISSIONS.STUDENT_VIEW,
  PERMISSIONS.STUDENT_DETAILS,
  PERMISSIONS.STUDENT_RESET_PASSWORD,
  PERMISSIONS.STUDENT_IMPERSONATE,
  PERMISSIONS.STUDENT_TOGGLE_REP,

  PERMISSIONS.MANAGE_LECTURERS,
  PERMISSIONS.LECTURER_VIEW,
  PERMISSIONS.LECTURER_MANAGE,

  PERMISSIONS.MANAGE_GROUPS,
  PERMISSIONS.GROUP_VIEW,
  PERMISSIONS.GROUP_MANAGE,

  PERMISSIONS.SEND_BROADCASTS,
  PERMISSIONS.BROADCAST_VIEW,
  PERMISSIONS.BROADCAST_SEND,

  PERMISSIONS.VIEW_SYSTEM_LOGS,
  PERMISSIONS.SYSTEM_LOGS_VIEW,
  PERMISSIONS.AUDIT_LOGS_VIEW,

  PERMISSIONS.SEARCH_VIEW,
  PERMISSIONS.ANALYTICS_VIEW
];

const ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    ...ALL_ADMIN_PERMISSIONS,
    PERMISSIONS.MANAGE_TENANTS,
    PERMISSIONS.TENANT_MANAGE,
    PERMISSIONS.ACCESS_DEV_PORTAL,
    PERMISSIONS.DEV_PORTAL_ACCESS
  ],
  UNI_ADMIN: ALL_ADMIN_PERMISSIONS,
  COLLEGE_ADMIN: ALL_ADMIN_PERMISSIONS,
  ADMIN: ALL_ADMIN_PERMISSIONS,
  LECTURER: [
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.SEARCH_VIEW
  ],
  REPRESENTATIVE: [
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.SEARCH_VIEW
  ],
  STUDENT: [
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.SEARCH_VIEW
  ]
};

/**
 * Normalizes permission key strings (e.g. 'SCHEDULE.EDIT' -> 'SCHEDULE_EDIT')
 */
function normalizePermission(perm) {
  if (!perm) return '';
  return String(perm).trim().toUpperCase().replace(/\./g, '_');
}

/**
 * Resolves permissions array for a given user object.
 */
function getUserPermissions(user) {
  if (!user) return [];
  
  const email = user.email?.trim().toLowerCase();
  if (email && DEVELOPER_EMAILS.includes(email)) {
    return Object.values(PERMISSIONS);
  }

  // If permissions array was custom assigned in user session/token, merge with role permissions
  const assigned = Array.isArray(user.permissions) ? user.permissions.map(normalizePermission) : [];
  const defaultRolePerms = ROLE_PERMISSIONS[user.role] || [];

  return Array.from(new Set([...defaultRolePerms, ...assigned]));
}

/**
 * Evaluates whether a user context possesses a specific permission or alias.
 */
function hasPermission(user, requiredPermission) {
  if (!user || !requiredPermission) return false;

  const target = normalizePermission(requiredPermission);
  const userPerms = getUserPermissions(user);

  if (userPerms.includes(target)) return true;

  // Backward compatibility alias checks
  if ((target === 'SCHEDULE_VIEW' || target === 'SCHEDULE_EDIT' || target === 'SCHEDULE_CREATE' || target === 'SCHEDULE_DELETE') && userPerms.includes('MANAGE_SCHEDULES')) {
    return true;
  }
  if (target === 'BROADCAST_SEND' && userPerms.includes('SEND_BROADCASTS')) {
    return true;
  }
  if ((target === 'STUDENT_VIEW' || target === 'STUDENT_DETAILS' || target === 'STUDENT_RESET_PASSWORD') && userPerms.includes('MANAGE_STUDENTS')) {
    return true;
  }
  if (target === 'DEV_PORTAL_ACCESS' && userPerms.includes('ACCESS_DEV_PORTAL')) {
    return true;
  }

  return false;
}

/**
 * Express Middleware Guard enforcing backend permissions.
 * Usage: router.put('/schedule/:id', verifyToken, requirePermission('SCHEDULE.EDIT'), updateScheduleHandler);
 */
function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication session required'
      });
    }

    if (!hasPermission(req.user, permissionKey)) {
      console.warn(`[RBAC] Access denied for user: ${req.user.email || req.user.id} (${req.user.role}). Required permission: ${permissionKey}`);
      return res.status(403).json({
        success: false,
        error: 'PERMISSION_DENIED',
        requiredPermission: permissionKey,
        message: `Forbidden: You do not possess the required permission (${permissionKey}) to perform this action.`
      });
    }

    next();
  };
}

module.exports = {
  PERMISSIONS,
  getUserPermissions,
  hasPermission,
  requirePermission,
  normalizePermission
};
