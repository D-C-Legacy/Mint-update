import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listOrders, type Order, type OrderStatus } from '../../api/orders';
import { ApiError } from '../../lib/api-client';
import { formatDate } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, spacing, radii, typography } from '../../theme';

const TABS: { label: string; value: OrderStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Disputed', value: 'DISPUTED' },
  { label: 'Pending Payment', value: 'PENDING_PAYMENT' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Shipped', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Refunded', value: 'REFUNDED' },
];

export function OrdersPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<OrderStatus | undefined>(undefined);
  const [items, setItems] = useState<Order[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(reset: boolean) {
    setLoading(true);
    setError(null);
    try {
      const page = await listOrders({ status, cursor: reset ? undefined : (cursor ?? undefined) });
      setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setItems([]);
    setCursor(null);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div>
      <h1 style={{ fontSize: typography.section, color: colors.text, margin: 0 }}>Orders</h1>

      <div style={{ display: 'flex', gap: spacing.xs, marginTop: spacing.lg, marginBottom: spacing.lg, flexWrap: 'wrap' }}>
        {TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatus(tab.value)}
            style={{
              border: 'none',
              borderRadius: radii.button,
              padding: `${spacing.xs}px ${spacing.md}px`,
              background: status === tab.value ? colors.brand : colors.canvas,
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

      {error && (
        <div style={{ color: colors.urgent, fontSize: typography.body, marginBottom: spacing.md }}>{error}</div>
      )}

      <div style={{ background: colors.canvas, borderRadius: radii.cardLarge, border: `1px solid ${colors.line}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.line}` }}>
              {['Order', 'Status', 'Total', 'Created', 'Shipped'].map((h) => (
                <th
                  key={h}
                  style={{ padding: spacing.md, fontSize: typography.meta, color: colors.textSecondary, fontWeight: 600 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((order) => (
              <tr
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                style={{
                  borderBottom: `1px solid ${colors.line}`,
                  cursor: 'pointer',
                  background: order.status === 'DISPUTED' ? '#FFF2F4' : 'transparent',
                  borderLeft: order.status === 'DISPUTED' ? `3px solid ${colors.urgent}` : '3px solid transparent',
                }}
              >
                <td style={{ padding: spacing.md, fontSize: typography.meta, color: colors.text, fontFamily: 'monospace' }}>
                  {order.id}
                </td>
                <td style={{ padding: spacing.md }}>
                  <StatusBadge status={order.status} />
                </td>
                <td style={{ padding: spacing.md, fontSize: typography.body, color: colors.text }}>
                  {formatMoney(order.totalAmount, order.currency)}
                </td>
                <td style={{ padding: spacing.md, fontSize: typography.body, color: colors.textSecondary }}>
                  {formatDate(order.createdAt)}
                </td>
                <td style={{ padding: spacing.md, fontSize: typography.body, color: colors.textSecondary }}>
                  {formatDate(order.shippedAt)}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ padding: spacing.xxl, textAlign: 'center', color: colors.textSecondary }}>
                  No orders in this view.
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
