import { useEffect, useState } from 'react';
import { listReviews, hideReview, unhideReview, type ReviewSummary, type ReviewStatus } from '../../api/reviews';
import { ApiError } from '../../lib/api-client';
import { formatDate } from '../../lib/format';
import { Section } from '../../components/Section';
import { inputStyle, secondaryButtonStyle, dangerButtonStyle, primaryButtonStyle } from '../../components/formStyles';
import { colors, spacing, radii, typography } from '../../theme';

const STATUS_FILTERS: { label: string; value: ReviewStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Visible', value: 'VISIBLE' },
  { label: 'Hidden', value: 'HIDDEN' },
];

export function ReviewsPage() {
  const [status, setStatus] = useState<ReviewStatus | undefined>(undefined);
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidingId, setHidingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load(reset: boolean) {
    setLoading(true);
    setError(null);
    try {
      const page = await listReviews({ status, cursor: reset ? undefined : (cursor ?? undefined) });
      setReviews((prev) => (reset ? page.items : [...prev, ...page.items]));
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setReviews([]);
    setCursor(null);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function submitHide(reviewId: string) {
    if (!reason.trim()) return;
    setBusyId(reviewId);
    try {
      const updated = await hideReview(reviewId, reason.trim());
      setReviews((prev) => prev.map((r) => (r.id === reviewId ? updated : r)));
      setHidingId(null);
      setReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to hide review.');
    } finally {
      setBusyId(null);
    }
  }

  async function submitUnhide(reviewId: string) {
    setBusyId(reviewId);
    try {
      const updated = await unhideReview(reviewId);
      setReviews((prev) => prev.map((r) => (r.id === reviewId ? updated : r)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to unhide review.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      <h1 style={{ fontSize: typography.section, color: colors.text, margin: 0 }}>Reviews</h1>

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
        {reviews.map((review) => (
          <div
            key={review.id}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600 }}>
                {'★'.repeat(review.rating)}
                {'☆'.repeat(5 - review.rating)} · seller {review.sellerId}
              </div>
              <span
                style={{
                  fontSize: typography.meta,
                  color: review.status === 'VISIBLE' ? colors.success : colors.urgent,
                  fontWeight: 600,
                }}
              >
                {review.status}
              </span>
            </div>
            {review.body && <div style={{ fontSize: typography.body, color: colors.text }}>{review.body}</div>}
            <div style={{ fontSize: typography.meta, color: colors.textSecondary }}>
              Order {review.orderId} · {formatDate(review.createdAt)}
            </div>
            {review.sellerResponseBody && (
              <div style={{ paddingLeft: spacing.md, borderLeft: `2px solid ${colors.line}` }}>
                <div style={{ fontSize: typography.meta, color: colors.textSecondary, fontWeight: 600 }}>Seller response</div>
                <div style={{ fontSize: typography.body }}>{review.sellerResponseBody}</div>
              </div>
            )}
            {review.status === 'HIDDEN' && review.hiddenReason && (
              <div style={{ fontSize: typography.meta, color: colors.textSecondary }}>Hidden: {review.hiddenReason}</div>
            )}

            {review.status === 'VISIBLE' ? (
              hidingId === review.id ? (
                <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
                  <input
                    placeholder="Reason for hiding"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={() => submitHide(review.id)} disabled={busyId === review.id || !reason.trim()} style={dangerButtonStyle}>
                    Confirm hide
                  </button>
                  <button onClick={() => setHidingId(null)} style={secondaryButtonStyle}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setHidingId(review.id);
                    setReason('');
                  }}
                  style={{ ...secondaryButtonStyle, alignSelf: 'flex-start' }}
                >
                  Hide
                </button>
              )
            ) : (
              <button onClick={() => submitUnhide(review.id)} disabled={busyId === review.id} style={{ ...secondaryButtonStyle, alignSelf: 'flex-start' }}>
                Unhide
              </button>
            )}
          </div>
        ))}
        {reviews.length === 0 && !loading && (
          <div style={{ padding: spacing.xxl, textAlign: 'center', color: colors.textSecondary }}>No reviews match this filter.</div>
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
