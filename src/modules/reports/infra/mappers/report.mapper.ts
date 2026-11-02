import { Report as PrismaReport } from '@prisma/client';
import { Report } from '../../domain/entities/report.entity';

export function toDomainReport(row: PrismaReport): Report {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    reporterUserId: row.reporterUserId,
    reason: row.reason,
    status: row.status,
    resolvedByUserId: row.resolvedByUserId,
    resolvedAt: row.resolvedAt,
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt,
  };
}
