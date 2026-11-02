import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getOrdersByStatus,
  getOrdersSummary,
  getPayoutsSummary,
  getSellersSummary,
  type OrdersSummaryPoint,
  type PayoutStatusSummary,
  type SellersSummary,
  type StatusCount,
} from '../../api/analytics';
import { ApiError } from '../../lib/api-client';
import { formatMoney } from '../../lib/money';
import { Section } from '../../components/Section';
import { colors, spacing, radii, typography } from '../../theme';
import {
  CHART_INK,
  SEQUENTIAL_PRIMARY,
  SEQUENTIAL_SECONDARY,
  orderStatusColor,
  payoutStatusColor,
  sellerStatusColor,
} from '../../lib/chartColors';

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function AnalyticsPage() {
  const [rangeDays, setRangeDays] = useState(30);
  const [ordersSummary, setOrdersSummary] = useState<OrdersSummaryPoint[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<StatusCount[]>([]);
  const [sellersSummary, setSellersSummary] = useState<SellersSummary | null>(null);
  const [payoutsSummary, setPayoutsSummary] = useState<PayoutStatusSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const to = new Date();
        const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
        const [orders, byStatus, sellers, payouts] = await Promise.all([
          getOrdersSummary({ from, to }),
          getOrdersByStatus(),
          getSellersSummary({ from, to }),
          getPayoutsSummary(),
        ]);
        setOrdersSummary(orders);
        setOrdersByStatus(byStatus);
        setSellersSummary(sellers);
        setPayoutsSummary(payouts);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load analytics.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [rangeDays]);

  const totalRevenue = ordersSummary.reduce((sum, p) => sum + p.revenue, 0);
  const totalOrders = ordersSummary.reduce((sum, p) => sum + p.orderCount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: typography.section, color: colors.text, margin: 0 }}>Analytics</h1>
        <div style={{ display: 'flex', gap: spacing.xs }}>
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              style={{
                border: 'none',
                borderRadius: radii.button,
                padding: `${spacing.xs}px ${spacing.md}px`,
                background: rangeDays === r.days ? colors.brand : colors.canvas,
                color: rangeDays === r.days ? colors.canvas : colors.text,
                fontSize: typography.body,
                fontWeight: rangeDays === r.days ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: spacing.sm,
          background: colors.softCanvas,
          borderRadius: radii.button,
          fontSize: typography.meta,
          color: colors.textSecondary,
        }}
      >
        Revenue below counts orders with status PAID or COMPLETED only, per the accepted plan —
        it does not include SHIPPED/DELIVERED orders, even though payment was already collected
        for those too. Worth re-checking with the founder: that likely undercounts real revenue.
        Flagged here rather than silently widened on our own judgment, since it changes what
        "revenue" means. Week/month bucketing isn't built either — day-only for v1, an open
        decision tracked in admin_progress.md.
      </div>

      {error && <div style={{ color: colors.urgent, fontSize: typography.body }}>{error}</div>}
      {loading && <div style={{ color: colors.textSecondary }}>Loading…</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
        <StatTile label="Revenue (PAID/COMPLETED, range)" value={formatMoney(totalRevenue, 'USD')} />
        <StatTile label="Orders (PAID/COMPLETED, range)" value={String(totalOrders)} />
      </div>

      <Section title="Revenue over time">
        {ordersSummary.length === 0 && !loading ? (
          <EmptyNote text="No PAID/COMPLETED orders in this range." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={ordersSummary} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={formatDay}
                stroke={CHART_INK.axis}
                tick={{ fill: CHART_INK.muted, fontSize: 12 }}
              />
              <YAxis stroke={CHART_INK.axis} tick={{ fill: CHART_INK.muted, fontSize: 12 }} width={70} />
              <Tooltip
                formatter={(value: number) => formatMoney(value, 'USD')}
                labelFormatter={(label: string) => formatDay(label)}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke={SEQUENTIAL_PRIMARY}
                strokeWidth={2}
                dot={{ r: 4, fill: SEQUENTIAL_PRIMARY }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Section>

      <Section title="Orders over time">
        {ordersSummary.length === 0 && !loading ? (
          <EmptyNote text="No PAID/COMPLETED orders in this range." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={ordersSummary} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={formatDay}
                stroke={CHART_INK.axis}
                tick={{ fill: CHART_INK.muted, fontSize: 12 }}
              />
              <YAxis stroke={CHART_INK.axis} tick={{ fill: CHART_INK.muted, fontSize: 12 }} width={40} allowDecimals={false} />
              <Tooltip labelFormatter={(label: string) => formatDay(label)} />
              <Line
                type="monotone"
                dataKey="orderCount"
                name="Orders"
                stroke={SEQUENTIAL_SECONDARY}
                strokeWidth={2}
                dot={{ r: 4, fill: SEQUENTIAL_SECONDARY }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Section>

      <Section title="Orders by status (current)">
        {ordersByStatus.length === 0 && !loading ? (
          <EmptyNote text="No orders yet." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ordersByStatus} margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
              <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
              <XAxis
                dataKey="status"
                stroke={CHART_INK.axis}
                tick={{ fill: CHART_INK.muted, fontSize: 11 }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
                padding={{ left: 20, right: 20 }}
              />
              <YAxis stroke={CHART_INK.axis} tick={{ fill: CHART_INK.muted, fontSize: 12 }} width={40} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Orders" radius={[4, 4, 0, 0]}>
                {ordersByStatus.map((row) => (
                  <Cell key={row.status} fill={orderStatusColor(row.status)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
        <Section title="Seller approvals over time">
          {!sellersSummary || sellersSummary.approvalsOverTime.length === 0 ? (
            <EmptyNote text="No approvals in this range." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={sellersSummary.approvalsOverTime} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
                <XAxis dataKey="day" tickFormatter={formatDay} stroke={CHART_INK.axis} tick={{ fill: CHART_INK.muted, fontSize: 12 }} />
                <YAxis stroke={CHART_INK.axis} tick={{ fill: CHART_INK.muted, fontSize: 12 }} width={40} allowDecimals={false} />
                <Tooltip labelFormatter={(label: string) => formatDay(label)} />
                <Line
                  type="monotone"
                  dataKey="approvalCount"
                  name="Approvals"
                  stroke={SEQUENTIAL_SECONDARY}
                  strokeWidth={2}
                  dot={{ r: 4, fill: SEQUENTIAL_SECONDARY }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Sellers by status (current)">
          {!sellersSummary || sellersSummary.byStatus.length === 0 ? (
            <EmptyNote text="No sellers yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sellersSummary.byStatus} margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
                <XAxis
                  dataKey="status"
                  stroke={CHART_INK.axis}
                  tick={{ fill: CHART_INK.muted, fontSize: 11 }}
                  interval={0}
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis stroke={CHART_INK.axis} tick={{ fill: CHART_INK.muted, fontSize: 12 }} width={40} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Sellers" radius={[4, 4, 0, 0]}>
                  {sellersSummary.byStatus.map((row) => (
                    <Cell key={row.status} fill={sellerStatusColor(row.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      <Section title="Payout totals by status (current)">
        {payoutsSummary.length === 0 && !loading ? (
          <EmptyNote text="No payouts yet." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={payoutsSummary} margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
              <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
              <XAxis
                dataKey="status"
                stroke={CHART_INK.axis}
                tick={{ fill: CHART_INK.muted, fontSize: 12 }}
                interval={0}
                padding={{ left: 20, right: 20 }}
              />
              <YAxis
                stroke={CHART_INK.axis}
                tick={{ fill: CHART_INK.muted, fontSize: 12 }}
                width={70}
                tickFormatter={(v: number) => formatMoney(v, 'USD')}
              />
              <Tooltip formatter={(value: number) => formatMoney(value, 'USD')} />
              <Bar dataKey="totalAmount" name="Total amount" radius={[4, 4, 0, 0]}>
                {payoutsSummary.map((row) => (
                  <Cell key={row.status} fill={payoutStatusColor(row.status)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: colors.canvas,
        borderRadius: radii.cardLarge,
        border: `1px solid ${colors.line}`,
        padding: spacing.lg,
      }}
    >
      <div style={{ fontSize: typography.meta, color: colors.textSecondary }}>{label}</div>
      <div style={{ fontSize: typography.title, color: colors.text, fontWeight: 700, marginTop: spacing.xs }}>
        {value}
      </div>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <div style={{ color: colors.textSecondary, fontSize: typography.body, padding: spacing.lg }}>{text}</div>;
}
