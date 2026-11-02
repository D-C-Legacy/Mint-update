import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { forceDeliverOrder, getOrder, refundOrder, type Order } from '../../api/orders';
import { ApiError } from '../../lib/api-client';
import { formatDate } from '../../lib/format';
import { formatMoney, dollarsToMinorUnits } from '../../lib/money';
import { StatusBadge } from '../../components/StatusBadge';
import { Section } from '../../components/Section';
import { colors, radii, spacing, typography } from '../../theme';
import { dangerButtonStyle, inputStyle, primaryButtonStyle, textareaStyle } from '../../components/formStyles';

const REFUNDABLE_STATUSES: Order['status'][] = ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'];

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  async function load() {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      setOrder(await getOrder(id));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load order.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function runAction(fn: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await fn();
      setActionMessage(successMessage);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div style={{ color: colors.textSecondary }}>Loading…</div>;
  if (loadError) return <div style={{ color: colors.urgent }}>{loadError}</div>;
  if (!order) return null;

  return (
    <div>
      <button onClick={() => navigate('/orders')} style={backLinkStyle}>
        ← Back to Orders
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs }}>
        <h1 style={{ fontSize: typography.section, color: colors.text, margin: 0, fontFamily: 'monospace' }}>
          {order.id}
        </h1>
        <StatusBadge status={order.status} />
      </div>
      <div style={{ color: colors.textSecondary, fontSize: typography.body, marginBottom: spacing.xl }}>
        Created {formatDate(order.createdAt)} · Sale {order.saleId}
      </div>

      {actionMessage && <div style={bannerStyle(colors.success, '#E3F6EC')}>{actionMessage}</div>}
      {actionError && <div style={bannerStyle(colors.urgent, '#FFE5E9')}>{actionError}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: spacing.xl }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
          <Section title="Amounts">
            <AmountRow label="Item" value={formatMoney(order.itemAmount, order.currency)} />
            <AmountRow label="Shipping" value={formatMoney(order.shippingAmount, order.currency)} />
            <AmountRow label="Tax" value={formatMoney(order.taxAmount, order.currency)} />
            <AmountRow label="Total" value={formatMoney(order.totalAmount, order.currency)} strong />
            <div style={{ height: spacing.sm }} />
            <AmountRow label={`Commission (${(order.commissionBps / 100).toFixed(2)}%)`} value={formatMoney(order.commissionAmount, order.currency)} />
            <AmountRow label="Seller net" value={formatMoney(order.sellerNetAmount, order.currency)} />
          </Section>

          <Section title="Buyer & seller">
            <AmountRow label="Buyer user" value={order.buyerUserId} mono />
            <AmountRow label="Seller" value={order.sellerId} mono />
          </Section>

          <Section title="Shipping">
            {Object.keys(order.shippingAddress).length > 0 ? (
              Object.entries(order.shippingAddress).map(([key, value]) => (
                <AmountRow key={key} label={key} value={String(value)} />
              ))
            ) : (
              <div style={{ color: colors.textSecondary, fontSize: typography.body }}>No shipping address set.</div>
            )}
            <div style={{ height: spacing.sm }} />
            <AmountRow label="Carrier" value={order.carrier ?? '—'} />
            <AmountRow label="Tracking" value={order.trackingNumber ?? '—'} />
            <AmountRow label="Shipped" value={formatDate(order.shippedAt)} />
            <AmountRow label="Delivered" value={formatDate(order.deliveredAt)} />
            {order.deliveryConfirmedBy && <AmountRow label="Confirmed by" value={order.deliveryConfirmedBy} />}
          </Section>

          {order.cancelledAt && (
            <Section title="Cancellation">
              <AmountRow label="Cancelled" value={formatDate(order.cancelledAt)} />
              <AmountRow label="Reason" value={order.cancelReason ?? '—'} />
            </Section>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          {order.status === 'SHIPPED' && (
            <Section title="Delivery">
              <button
                disabled={busy}
                onClick={() => runAction(() => forceDeliverOrder(order.id), 'Marked as delivered.')}
                style={primaryButtonStyle}
              >
                Force-deliver
              </button>
            </Section>
          )}

          {REFUNDABLE_STATUSES.includes(order.status) && (
            <Section title="Refund">
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={`Amount in ${order.currency} (e.g. 19.99)`}
                  style={inputStyle}
                />
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Reason for refund"
                  rows={3}
                  style={textareaStyle}
                />
                <button
                  disabled={busy || !refundAmount || refundReason.trim().length === 0}
                  onClick={() =>
                    runAction(
                      () => refundOrder(order.id, dollarsToMinorUnits(refundAmount), refundReason.trim()),
                      `Refunded ${formatMoney(dollarsToMinorUnits(refundAmount), order.currency)}.`,
                    ).then(() => {
                      setRefundAmount('');
                      setRefundReason('');
                    })
                  }
                  style={dangerButtonStyle}
                >
                  Issue refund
                </button>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function AmountRow({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.body, padding: '2px 0' }}>
      <div style={{ color: colors.textSecondary }}>{label}</div>
      <div style={{ color: colors.text, fontWeight: strong ? 700 : 400, fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value}
      </div>
    </div>
  );
}

function bannerStyle(color: string, bg: string) {
  return {
    background: bg,
    color,
    borderRadius: radii.button,
    padding: spacing.md,
    marginBottom: spacing.lg,
    fontSize: typography.body,
  } as const;
}

const backLinkStyle = {
  border: 'none',
  background: 'none',
  color: colors.textSecondary,
  fontSize: typography.meta,
  cursor: 'pointer',
  padding: 0,
  marginBottom: spacing.md,
} as const;
