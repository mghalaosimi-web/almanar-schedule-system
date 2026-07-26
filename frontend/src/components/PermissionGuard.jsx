import React from 'react';
import { SessionService } from '../utils/sessionService';
import { hasPermission } from '../utils/permissionRegistry';

/**
 * UI Guard Component.
 * Conditionally renders children if the authenticated user has the required permission.
 * Otherwise renders fallback (default: null).
 *
 * Usage:
 * <PermissionGuard permission={PERMISSIONS.SCHEDULE.PUBLISH} fallback={null}>
 *   <button>نشر الجدول</button>
 * </PermissionGuard>
 */
export default function PermissionGuard({ permission, user, fallback = null, children }) {
  const currentUser = user || SessionService.getUser();
  if (!currentUser) return fallback;
  if (!permission) return children;

  const allowed = hasPermission(currentUser, permission);
  if (!allowed) return fallback;

  return <>{children}</>;
}
