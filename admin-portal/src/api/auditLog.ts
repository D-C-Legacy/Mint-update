// Typed wrapper around GET /admin/audit-log. Shape hand-mirrors audit-log.entity.ts.
import { apiClient } from '../auth/AuthContext';
import type { CursorPage } from './applications';

export type AuditLogEntry = {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export function listAuditLog(params: {
  actorUserId?: string;
  targetType?: string;
  cursor?: string;
}): Promise<CursorPage<AuditLogEntry>> {
  return apiClient.request('/admin/audit-log', {
    query: { actorUserId: params.actorUserId, targetType: params.targetType, cursor: params.cursor, limit: 25 },
  });
}
