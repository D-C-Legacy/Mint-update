import { useEffect, useState } from 'react';
import { listReports, resolveReport, deleteMessage, type ReportSummary, type ReportStatus } from '../../api/reports';
import { ApiError } from '../../lib/api-client';
import { formatDate } from '../../lib/format';
import { Section } from '../../components/Section';
import { secondaryButtonStyle, dangerButtonStyle, primaryButtonStyle } from '../../components/formStyles';
import { colors, spacing, radii, typography } from '../../theme';

const STATUS_FILTERS: { label: string; value: ReportStatus | undefined }[] = [
  { label: 'Open', value: 'OPEN' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Dismissed', value: 'DISMISSED' },
  { label: 'All', value: undefined },
];

export function ReportsPage() {
  const [status, setStatus] = useState<ReportStatus | undefined>('OPEN');
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load(reset: boolean) {
    setLoading(true);
    setError(null);
    try {
      const page = await listReports({ status, cursor: reset ? undefined : (cursor ?? undefined) });
      setReports((prev) => (reset ? page.items : [...prev, ...page.items]));
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setReports([]);
    setCursor(null);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function act(reportId: string, fn: () => Promise<ReportSummary>) {
    setBusyId(reportId);
    try {
      const updated = await fn();
      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function removeReportedMessage(report: ReportSummary) {
    setBusyId(report.id);
    try {
      await deleteMessage(report.targetId);
      const updated = await resolveReport(report.id, 'RESOLVED', 'Message removed.');
      setReports((prev) => prev.map((r) => (r.id === report.id ? updated : r)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove message.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      <h1 style={{ fontSize: typography.section, color: colors.text, margin: 0 }}>Reports</h1>

      <Section title="Filter">
        <div style={{ display: 'flex', gap: spacing.sm }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setStatus(f.value)}
              style={status === f.value ? primaryButtonStyle : secondaryButtonStyle}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Section>

      {error && <div style={{ color: colors.urgent, fontSize: typography.body }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        {reports.map((report) => (
          <div
            key={report.id}
            style={{
              background: colors.canvas,
              border: `1px solid ${colors.line}`,
              borderRadius: radii.cardLarge,
              padding: spacing.lg,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.sm,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600 }}>
                {report.targetType} · {report.targetId}
              </div>
              <span style={{ fontSize: typography.meta, color: colors.textSecondary }}>{formatDate(report.createdAt)}</span>
            </div>
            <div style={{ fontSize: typography.body, color: colors.text }}>Reason: {report.reason}</div>
            {report.preview && (
              <div style={{ background: colors.desktop, borderRadius: radii.button, padding: spacing.sm, fontSize: typography.meta }}>
                {report.targetType === 'REVIEW' ? (
                  <>
                    {'★'.repeat(Number(report.preview['rating'] ?? 0))} {String(report.preview['body'] ?? '')}
                  </>
                ) : (
                  <>{String(report.preview['body'] ?? '')}</>
                )}
              </div>
            )}
            <div style={{ fontSize: typography.meta, color: colors.textSecondary, fontWeight: 600 }}>{report.status}</div>
            {report.status === 'OPEN' ? (
              <div style={{ display: 'flex', gap: spacing.sm }}>
                {report.targetType === 'MESSAGE' && (
                  <button onClick={() => removeReportedMessage(report)} disabled={busyId === report.id} style={dangerButtonStyle}>
                    Remove message
                  </button>
                )}
                <button
                  onClick={() => act(report.id, () => resolveReport(report.id, 'RESOLVED'))}
                  disabled={busyId === report.id}
                  style={secondaryButtonStyle}
                >
                  Mark resolved
                </button>
                <button
                  onClick={() => act(report.id, () => resolveReport(report.id, 'DISMISSED'))}
                  disabled={busyId === report.id}
                  style={secondaryButtonStyle}
                >
                  Dismiss
                </button>
              </div>
            ) : (
              report.resolutionNote && <div style={{ fontSize: typography.meta, color: colors.textSecondary }}>Note: {report.resolutionNote}</div>
            )}
          </div>
        ))}
        {reports.length === 0 && !loading && (
          <div style={{ padding: spacing.xxl, textAlign: 'center', color: colors.textSecondary }}>No reports match this filter.</div>
        )}
      </div>

      {cursor && (
        <button onClick={() => load(false)} disabled={loading} style={{ ...secondaryButtonStyle, alignSelf: 'flex-start' }}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
