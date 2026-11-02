import { Report } from '../../domain/entities/report.entity';

export function toReportView(report: Report, preview: Record<string, unknown> | null): Record<string, unknown> {
  return {
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    status: report.status,
    resolutionNote: report.resolutionNote,
    createdAt: report.createdAt.toISOString(),
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
    preview,
  };
}
