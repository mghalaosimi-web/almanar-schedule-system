import axios from 'axios';
import { API_URL } from '../config';
import { SessionService } from './sessionService';

/**
 * Computes state differences between before and after objects.
 * Returns an array of modified fields with old and new values.
 */
export function computeStateDiff(before = {}, after = {}) {
  if (!before && !after) return [];
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
  const diffs = [];

  for (const key of keys) {
    const oldVal = before?.[key];
    const newVal = after?.[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({
        field: key,
        old: oldVal ?? null,
        new: newVal ?? null,
      });
    }
  }

  return diffs;
}

/**
 * Records an audit event for sensitive operations.
 */
export async function recordAuditEvent({ action, entity, entityId, before = null, after = null, source = 'Frontend_App' }) {
  const user = SessionService.getUser();
  const token = SessionService.getToken();

  const auditEntry = {
    actor: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : { name: 'Anonymous' },
    action: action || 'UNKNOWN_ACTION',
    entity: entity || 'General',
    entityId: entityId ?? null,
    before,
    after,
    diff: computeStateDiff(before, after),
    timestamp: new Date().toISOString(),
    source,
  };

  // 1. In-memory & LocalStorage buffer for instant inspection
  try {
    const existing = JSON.parse(localStorage.getItem('manar_audit_logs') || '[]');
    existing.unshift(auditEntry);
    localStorage.setItem('manar_audit_logs', JSON.stringify(existing.slice(0, 100)));
  } catch (e) {
    console.warn('[AuditLogger] Local cache write failed:', e);
  }

  // 2. Dispatch to Backend Audit Endpoint if session is active
  if (token) {
    try {
      await axios.post(`${API_URL}/api/admin/audit-logs`, auditEntry, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      // Non-blocking: audit logs fall back to local queue
      console.warn('[AuditLogger] Backend sync skipped or unavailable:', err.message);
    }
  }

  return auditEntry;
}

export function getLocalAuditLogs() {
  try {
    return JSON.parse(localStorage.getItem('manar_audit_logs') || '[]');
  } catch {
    return [];
  }
}
