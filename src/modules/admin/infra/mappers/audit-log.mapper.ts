import type { AuditLog as PrismaAuditLog } from '@prisma/client';
import { AuditLog } from '../../domain/entities/audit-log.entity';

export function toDomainAuditLog(row: PrismaAuditLog): AuditLog {
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    before: row.before as Record<string, unknown> | null,
    after: row.after as Record<string, unknown> | null,
    reason: row.reason,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt,
  };
}
