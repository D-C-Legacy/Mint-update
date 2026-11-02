import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listApplications, type ApplicationDecision, type SellerApplicationSummary } from '../../api/applications';
import { ApiError } from '../../lib/api-client';
import { formatDate } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, spacing, radii, typography } from '../../theme';

const TABS: { label: string; value: ApplicationDecision | undefined }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'All', value: undefined },
];

export function ApplicationsPage() {
  const navigate = useNavigate();
  const [decision, setDecision] = useState<ApplicationDecision | undefined>('PENDING');
  const [items, setItems] = useState<SellerApplicationSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(reset: boolean) {
    setLoading(true);
    setError(null);
    try {
      const page = await listApplications({ decision, cursor: reset ? undefined : (cursor ?? undefined) });
      setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setItems([]);
    setCursor(null);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision]);

  return (
    <div>
      <h1 style={{ fontSize: typography.section, color: colors.text, margin: 0 }}>Seller Applications</h1>

      <div style={{ display: 'flex', gap: spacing.xs, marginTop: spacing.lg, marginBottom: spacing.lg }}>
        {TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setDecision(tab.value)}
            style={{
              border: 'none',
              borderRadius: radii.button,
              padding: `${spacing.xs}px ${spacing.md}px`,
              background: decision === tab.value ? colors.brand : colors.canvas,
              color: decision === tab.value ? colors.canvas : colors.text,
              fontSize: typography.body,
              fontWeight: decision === tab.value ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ color: colors.urgent, fontSize: typography.body, marginBottom: spacing.md }}>{error}</div>
      )}

      <div style={{ background: colors.canvas, borderRadius: radii.cardLarge, border: `1px solid ${colors.line}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.line}` }}>
              {['Seller', 'Type', 'Status', 'Submitted', 'Reviewed'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: spacing.md,
                    fontSize: typography.meta,
                    color: colors.textSecondary,
                    fontWeight: 600,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((app) => (
              <tr
                key={app.applicationId}
                onClick={() => navigate(`/applications/${app.applicationId}`)}
                style={{ borderBottom: `1px solid ${colors.line}`, cursor: 'pointer' }}
              >
                <td style={{ padding: spacing.md, fontSize: typography.body, color: colors.text }}>
                  <div style={{ fontWeight: 600 }}>{app.displayName}</div>
                  <div style={{ color: colors.textSecondary, fontSize: typography.meta }}>{app.legalName}</div>
                </td>
                <td style={{ padding: spacing.md, fontSize: typography.body, color: colors.text }}>{app.type}</td>
                <td style={{ padding: spacing.md }}>
                  <StatusBadge status={app.status} />
                </td>
                <td style={{ padding: spacing.md, fontSize: typography.body, color: colors.textSecondary }}>
                  {formatDate(app.submittedAt)}
                </td>
                <td style={{ padding: spacing.md, fontSize: typography.body, color: colors.textSecondary }}>
                  {formatDate(app.reviewedAt)}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ padding: spacing.xxl, textAlign: 'center', color: colors.textSecondary }}>
                  No applications in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cursor && (
        <button
          onClick={() => load(false)}
          disabled={loading}
          style={{
            marginTop: spacing.lg,
            border: `1px solid ${colors.line}`,
            background: colors.canvas,
            borderRadius: radii.button,
            padding: `${spacing.sm}px ${spacing.lg}px`,
            fontSize: typography.body,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
