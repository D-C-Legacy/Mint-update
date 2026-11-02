// Typed wrappers around the admin report-moderation routes (Phase 8 — not in 05-API-SPEC.md).
// A report flags a review or a message; the preview is assembled server-side in AdminController
// (not ReportsService, to avoid a circular module dependency — see reports.module.ts).
import { apiClient } from '../auth/AuthContext';
import type { CursorPage } from './applications';

export type ReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';
export type ReportTargetType = 'REVIEW' | 'MESSAGE';

export type ReportSummary = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  preview: Record<string, unknown> | null;
};

export function listReports(params: { status?: ReportStatus; cursor?: string }): Promise<CursorPage<ReportSummary>> {
  return apiClient.request('/admin/reports', { query: { status: params.status, cursor: params.cursor, limit: 25 } });
}

export function resolveReport(reportId: string, status: 'RESOLVED' | 'DISMISSED', note?: string): Promise<ReportSummary> {
  return apiClient.request(`/admin/reports/${reportId}/resolve`, { method: 'POST', body: { status, note } });
}

// Mirrors the existing chat/messages/:id/delete precedent — a real hard delete, used here when a
// reported message turns out to be the violation.
export function deleteMessage(messageId: string): Promise<{ deleted: true }> {
  return apiClient.request(`/admin/messages/${messageId}/delete`, { method: 'POST' });
}
