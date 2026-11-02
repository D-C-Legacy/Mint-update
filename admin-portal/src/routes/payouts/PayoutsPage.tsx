import { useEffect, useState, type ReactNode } from 'react';
import {
  getReconciliationReport,
  holdPayout,
  listPayoutRuns,
  listPayouts,
  triggerPayoutRun,
  type Payout,
  type PayoutRun,
  type PayoutStatus,
  type ReconciliationReport,
} from '../../api/payouts';
import { ApiError } from '../../lib/api-client';
import { formatDate } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { StatusBadge } from '../../components/StatusBadge';
import { Section } from '../../components/Section';
import { primaryButtonStyle, secondaryButtonStyle } from '../../components/formStyles';
import { colors, spacing, radii, typography } from '../../theme';

const PAYOUT_TABS: { label: string; value: PayoutStatus }[] = [
  { label: 'Failed', value: 'FAILED' },
  { label: 'Held', value: 'HELD' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Reversed', value: 'REVERSED' },
];

export function PayoutsPage() {
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [runs, setRuns] = useState<PayoutRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);

  const [status, setStatus] = useState<PayoutStatus>('FAILED');
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);

  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);

  async function loadRuns() {
    setRunsLoading(true);
    setRunsError(null);
    try {
      const page = await listPayoutRuns({});
      setRuns(page.items);
    } catch (err) {
      setRunsError(err instanceof ApiError ? err.message : 'Failed to load payout runs.');
    } finally {
      setRunsLoading(false);
    }
  }

  async function loadPayouts() {
    setPayoutsLoading(true);
    setPayoutsError(null);
    try {
      const page = await listPayouts({ status });
      setPayouts(page.items);
    } catch (err) {
      setPayoutsError(err instanceof ApiError ? err.message : 'Failed to load payouts.');
    } finally {
      setPayoutsLoading(false);
    }
  }

  async function loadReport() {
    setReportLoading(true);
    setReportError(null);
    try {
      setReport(await getReconciliationReport());
    } catch (err) {
      setReportError(err instanceof ApiError ? err.message : 'Failed to load reconciliation report.');
    } finally {
      setReportLoading(false);
    }
  }

  useEffect(() => {
    loadRuns();
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPayouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleTriggerRun() {
    setBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await triggerPayoutRun();
      setActionMessage(`Payout run complete: ${result.payoutsCreated} payout(s) created.`);
      await loadRuns();
      await loadPayouts();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Payout run failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleHold(payoutId: string) {
    setBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await holdPayout(payoutId);
      setActionMessage(`Payout ${payoutId} held.`);
      await loadPayouts();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Hold failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      <h1 style={{ fontSize: typography.section, color: colors.text, margin: 0 }}>Payouts & Ledger</h1>

      {actionMessage && <div style={bannerStyle(colors.success, '#E3F6EC')}>{actionMessage}</div>}
      {actionError && <div style={bannerStyle(colors.urgent, '#FFE5E9')}>{actionError}</div>}

      <Section title="Payout runs">
        <div style={{ marginBottom: spacing.md }}>
          <button disabled={busy} onClick={handleTriggerRun} style={primaryButtonStyle}>
            Trigger payout run
          </button>
          <span style={{ marginLeft: spacing.sm, fontSize: typography.meta, color: colors.textSecondary }}>
            Uses a mock transfer adapter — no real money moves.
          </span>
        </div>
        {runsError && <div style={{ color: colors.urgent, fontSize: typography.body }}>{runsError}</div>}
        <SimpleTable
          loading={runsLoading}
          empty="No payout runs yet."
          headers={['Run', 'Status', 'Total', 'Payouts', 'Started', 'Completed']}
          rows={runs.map((run) => [
            <span style={{ fontFamily: 'monospace' }}>{run.id}</span>,
            <StatusBadge status={run.status} />,
            formatMoney(run.totalAmount, 'USD'),
            String(run.payoutCount),
            formatDate(run.startedAt),
            formatDate(run.completedAt),
          ])}
        />
      </Section>

      <Section title="Payouts">
        <div style={{ display: 'flex', gap: spacing.xs, marginBottom: spacing.md, flexWrap: 'wrap' }}>
          {PAYOUT_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              style={{
                border: 'none',
                borderRadius: radii.button,
                padding: `${spacing.xs}px ${spacing.md}px`,
                background: status === tab.value ? colors.brand : colors.softCanvas,
                color: status === tab.value ? colors.canvas : colors.text,
                fontSize: typography.body,
                fontWeight: status === tab.value ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {payoutsError && <div style={{ color: colors.urgent, fontSize: typography.body }}>{payoutsError}</div>}
        <SimpleTable
          loading={payoutsLoading}
          empty="No payouts in this view."
          headers={['Payout', 'Seller', 'Amount', 'Status', 'Failure reason', 'Created', '']}
          rows={payouts.map((payout) => [
            <span style={{ fontFamily: 'monospace' }}>{payout.id}</span>,
            <span style={{ fontFamily: 'monospace' }}>{payout.sellerId}</span>,
            formatMoney(payout.amount, payout.currency),
            <StatusBadge status={payout.status} />,
            payout.failureReason ?? '—',
            formatDate(payout.createdAt),
            payout.status === 'PENDING' ? (
              <button disabled={busy} onClick={() => handleHold(payout.id)} style={secondaryButtonStyle}>
                Hold
              </button>
            ) : null,
          ])}
        />
      </Section>

      <Section title="Ledger reconciliation">
        {reportLoading && <div style={{ color: colors.textSecondary }}>Loading…</div>}
        {reportError && <div style={{ color: colors.urgent, fontSize: typography.body }}>{reportError}</div>}
        {report && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            <ReportRow label="Overall" value={report.ok ? 'OK' : 'ISSUES FOUND'} bad={!report.ok} />
            <ReportRow label="Unbalanced transactions" value={String(report.unbalancedTransactionIds.length)} bad={report.unbalancedTransactionIds.length > 0} />
            <ReportRow label="Sellers checked" value={String(report.sellersChecked)} />
            <ReportRow label="Balance mismatches" value={String(report.balanceMismatches.length)} bad={report.balanceMismatches.length > 0} />
            <ReportRow
              label="Ledger cash vs Stripe"
              value={`${report.cashCheck.status} · ledger ${formatMoney(report.cashCheck.ledgerCashBalance, 'USD')} / Stripe ${formatMoney(report.cashCheck.processorCashBalance, 'USD')}`}
              bad={report.cashCheck.status === 'MISMATCH'}
            />
            {report.balanceMismatches.length > 0 && (
              <div style={{ fontSize: typography.meta, color: colors.textSecondary }}>
                {report.balanceMismatches.map((m) => (
                  <div key={`${m.sellerId}-${m.field}`}>
                    {m.sellerId} · {m.field}: cached {m.cached}, recomputed {m.recomputed}
                  </div>
                ))}
              </div>
            )}
            {report.cashCheck.status === 'MISMATCH' && (
              <div style={{ fontSize: typography.meta, color: colors.textSecondary }}>
                Stripe wallet breakdown: available {formatMoney(report.cashCheck.processorAvailableMinor, 'USD')} +
                pending {formatMoney(report.cashCheck.processorPendingMinor, 'USD')}.
              </div>
            )}
            <div
              style={{
                marginTop: spacing.sm,
                padding: spacing.md,
                background: colors.softCanvas,
                borderRadius: radii.button,
                fontSize: typography.meta,
                color: colors.textSecondary,
              }}
            >
              <strong>Ledger cash vs. processor totals is live</strong> (compares the ledger's own cash against the
              real Stripe wallet). The ledger has no fee accounts and Stripe's wallet is already fee-net, so a clean
              ledger matches exactly — a MISMATCH needs a human look, it is never auto-absorbed.
              <br />
              <strong>Payout holds are one-way.</strong> There is no "release" route yet — once a
              payout is held above, it stays held until that's built.
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
  loading,
  empty,
}: {
  headers: string[];
  rows: (string | number | ReactNode)[][];
  loading: boolean;
  empty: string;
}) {
  return (
    <div style={{ border: `1px solid ${colors.line}`, borderRadius: radii.button, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.line}` }}>
            {headers.map((h) => (
              <th key={h} style={{ padding: spacing.sm, fontSize: typography.meta, color: colors.textSecondary, fontWeight: 600 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${colors.line}` }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: spacing.sm, fontSize: typography.body, color: colors.text }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && !loading && (
            <tr>
              <td colSpan={headers.length} style={{ padding: spacing.lg, textAlign: 'center', color: colors.textSecondary }}>
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReportRow({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.body }}>
      <div style={{ color: colors.textSecondary }}>{label}</div>
      <div style={{ color: bad ? colors.urgent : colors.text, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function bannerStyle(color: string, bg: string) {
  return { background: bg, color, borderRadius: radii.button, padding: spacing.md, fontSize: typography.body } as const;
}
