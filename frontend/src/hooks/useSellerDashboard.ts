import { useEffect, useState } from 'react';
import { describeApiError } from '../api/describe-error';
import {
  getOrdersByStatus,
  getOrdersSummary,
  getViewersSummary,
  type OrdersSummaryPoint,
  type StatusCount,
} from '../api/seller-analytics';

// The three range chips are plain strings (see `Chips`), so the hook is keyed by label too. Each
// label maps to honest query windows: calendar-week/completed-month semantics aren't what the
// backend computes, so the labels say exactly what window is queried instead of pretending.
export const DASHBOARD_RANGE_LABELS = ['Last 7 days', 'Last 30 days', 'All time'] as const;
export type DashboardRangeLabel = (typeof DASHBOARD_RANGE_LABELS)[number];
const DEFAULT_RANGE_LABEL: DashboardRangeLabel = 'Last 30 days';

const DAY_MS = 24 * 60 * 60 * 1000;

// Date buckets are UTC days on the backend (date_trunc), so chart day keys align by UTC too.
function utcMidnight(now = Date.now()): Date {
  return new Date(new Date(now).toISOString().slice(0, 10) + 'T00:00:00.000Z');
}
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Returns {from, to} ISO datetimes, or null when no window narrows the query ("all time" passes
// an explicit epoch-0 from, since omitting both would silently mean the backend's 30-day default).
function rangeWindow(label: string): { from: string; to: string } {
  const now = new Date().toISOString();
  const midnight = utcMidnight().getTime();
  const days = label === 'Last 7 days' ? 7 : label === 'Last 30 days' ? 30 : null;
  if (days === null) return { from: new Date(0).toISOString(), to: now };
  return { from: new Date(midnight - (days - 1) * DAY_MS).toISOString(), to: now };
}

export type SellerDashboardData = {
  // Range-scoped card values, sums across the range's day buckets. Both money values are minor
  // units; divide by 100 for display, same as every other screen.
  salesMinor: number;
  orderCount: number;
  totalPeakViewers: number;
  conversionRate: number;
  // All-time snapshot (the by-status route has no range), safe-labeled for display via
  // ORDER_STATUS_LABEL in the caller.
  statusCounts: StatusCount[];
  // The chart is always the last 7 days regardless of the selected range, zero-filled so a no-sale
  // day shows as an empty bar instead of silently shifting the week's labels.
  week: Array<{ day: string; revenue: number }>;
};

export type SellerDashboardStatus =
  | { status: 'loading' }
  | { status: 'ready'; data: SellerDashboardData }
  | { status: 'error'; message: string };

function sumPoints(points: OrdersSummaryPoint[]): { salesMinor: number; orderCount: number } {
  return points.reduce(
    (acc, p) => ({
      salesMinor: acc.salesMinor + Number(p.revenue),
      orderCount: acc.orderCount + p.orderCount,
    }),
    { salesMinor: 0, orderCount: 0 },
  );
}

function buildWeek(points: OrdersSummaryPoint[]): SellerDashboardData['week'] {
  const byDay = new Map<string, number>();
  for (const p of points) {
    const key = p.day.slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(p.revenue));
  }
  const midnight = utcMidnight().getTime();
  const week: SellerDashboardData['week'] = [];
  for (let i = 6; i >= 0; i--) {
    const d = dayKey(new Date(midnight - i * DAY_MS));
    week.push({ day: d, revenue: byDay.get(d) ?? 0 });
  }
  return week;
}

export function describeConversion(rate: number): string {
  return rate === Math.floor(rate) ? String(rate) : String(Math.round(rate * 10) / 10);
}

// Thousands-separated integer only — Hermes/browser-safe, mirrors the mock's "1,482" shape.
export function formatCount(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Shared loading for both Seller dashboards (mobile `DashboardMobile` and web `Dashboard.web`) so
// they can't drift: all analytics calls live here, screens only render. Cards show "—" while
// loading and a real error message on failure — never another set of fake numbers.
export function useSellerDashboard(rangeLabel: string = DEFAULT_RANGE_LABEL): {
  state: SellerDashboardStatus;
  reload: () => void;
} {
  const label = (DASHBOARD_RANGE_LABELS as readonly string[]).includes(rangeLabel)
    ? (rangeLabel as DashboardRangeLabel)
    : DEFAULT_RANGE_LABEL;
  const [state, setState] = useState<SellerDashboardStatus>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    const range = rangeWindow(label);
    const chartRange = rangeWindow('Last 7 days');
    void (async () => {
      try {
        const [summary, viewers, chartPoints, byStatus] = await Promise.all([
          getOrdersSummary(range),
          getViewersSummary(range),
          getOrdersSummary(chartRange),
          getOrdersByStatus(),
        ]);
        if (!alive) return;
        const sums = sumPoints(summary);
        setState({
          status: 'ready',
          data: {
            salesMinor: sums.salesMinor,
            orderCount: sums.orderCount,
            totalPeakViewers: viewers.totalPeakViewers,
            conversionRate: viewers.conversionRate,
            statusCounts: byStatus,
            week: buildWeek(chartPoints),
          },
        });
      } catch (err) {
        if (!alive) return;
        setState({ status: 'error', message: describeApiError(err) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [label, version]);

  const reload = () => setVersion((v) => v + 1);
  return { state, reload };
}
