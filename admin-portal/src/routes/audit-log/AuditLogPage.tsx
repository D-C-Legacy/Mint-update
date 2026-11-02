import { useEffect, useState, type FormEvent } from 'react';
import { listAuditLog, type AuditLogEntry } from '../../api/auditLog';
import { ApiError } from '../../lib/api-client';
import { formatDate } from '../../lib/format';
import { Section } from '../../components/Section';
import { inputStyle, secondaryButtonStyle } from '../../components/formStyles';
import { colors, spacing, radii, typography } from '../../theme';

export function AuditLogPage() {
  const [actorUserId, setActorUserId] = useState('');
  const [targetType, setTargetType] = useState('');
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(reset: boolean) {
    setLoading(true);
    setError(null);
    try {
      const page = await listAuditLog({
        actorUserId: actorUserId.trim() || undefined,
        targetType: targetType.trim() || undefined,
        cursor: reset ? undefined : (cursor ?? undefined),
      });
      setEntries((prev) => (reset ? page.items : [...prev, ...page.items]));
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load audit log.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setEntries([]);
    setCursor(null);
    load(true);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      <h1 style={{ fontSize: typography.section, color: colors.text, margin: 0 }}>Audit Log</h1>

      <Section title="Filter">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Actor user id"
            value={actorUserId}
            onChange={(e) => setActorUserId(e.target.value)}
            style={{ ...inputStyle, width: 260, fontFamily: 'monospace' }}
          />
          <input
            placeholder="Target type (e.g. Seller, Order, Payout)"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            style={{ ...inputStyle, width: 260 }}
          />
          <button type="submit" disabled={loading} style={secondaryButtonStyle}>
            Search
          </button>
        </form>
      </Section>

      {error && <div style={{ color: colors.urgent, fontSize: typography.body }}>{error}</div>}

      <div style={{ background: colors.canvas, borderRadius: radii.cardLarge, border: `1px solid ${colors.line}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.line}` }}>
              {['When', 'Actor', 'Action', 'Target', 'Reason'].map((h) => (
                <th key={h} style={{ padding: spacing.md, fontSize: typography.meta, color: colors.textSecondary, fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} style={{ borderBottom: `1px solid ${colors.line}`, verticalAlign: 'top' }}>
                <td style={{ padding: spacing.md, fontSize: typography.body, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                  {formatDate(entry.createdAt)}
                </td>
                <td style={{ padding: spacing.md, fontSize: typography.meta, color: colors.text, fontFamily: 'monospace' }}>
                  {entry.actorUserId}
                </td>
                <td style={{ padding: spacing.md, fontSize: typography.body, color: colors.text, fontWeight: 600 }}>
                  {entry.action}
                </td>
                <td style={{ padding: spacing.md, fontSize: typography.meta, color: colors.text }}>
                  {entry.targetType}
                  <br />
                  <span style={{ fontFamily: 'monospace', color: colors.textSecondary }}>{entry.targetId}</span>
                </td>
                <td style={{ padding: spacing.md, fontSize: typography.meta, color: colors.textSecondary }}>
                  {entry.reason ?? '—'}
                </td>
              </tr>
            ))}
            {entries.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ padding: spacing.xxl, textAlign: 'center', color: colors.textSecondary }}>
                  No audit entries match this filter.
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
            border: `1px solid ${colors.line}`,
            background: colors.canvas,
            borderRadius: radii.button,
            padding: `${spacing.sm}px ${spacing.lg}px`,
            fontSize: typography.body,
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
