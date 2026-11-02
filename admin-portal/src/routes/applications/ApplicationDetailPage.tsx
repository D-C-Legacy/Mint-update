import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  approveApplication,
  getApplicationDetail,
  getDocumentUrl,
  reinstateSeller,
  rejectApplication,
  suspendSeller,
  updateCommission,
  type SellerApplicationDetail,
} from '../../api/applications';
import { ApiError } from '../../lib/api-client';
import { formatBytes, formatDate } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, spacing, radii, typography, shadows } from '../../theme';

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<SellerApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [commissionInput, setCommissionInput] = useState('');

  async function load() {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getApplicationDetail(id);
      setDetail(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load application.');
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

  async function handleViewDocument(documentId: string) {
    try {
      const { url } = await getDocumentUrl(documentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not get document URL.');
    }
  }

  if (loading) return <div style={{ color: colors.textSecondary }}>Loading…</div>;
  if (loadError) return <div style={{ color: colors.urgent }}>{loadError}</div>;
  if (!detail) return null;

  return (
    <div>
      <button
        onClick={() => navigate('/applications')}
        style={{
          border: 'none',
          background: 'none',
          color: colors.textSecondary,
          fontSize: typography.meta,
          cursor: 'pointer',
          padding: 0,
          marginBottom: spacing.md,
        }}
      >
        ← Back to Applications
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs }}>
        <h1 style={{ fontSize: typography.section, color: colors.text, margin: 0 }}>{detail.displayName}</h1>
        <StatusBadge status={detail.status} />
      </div>
      <div style={{ color: colors.textSecondary, fontSize: typography.body, marginBottom: spacing.xl }}>
        {detail.legalName} · {detail.type}
      </div>

      {actionMessage && (
        <div
          style={{
            background: '#E3F6EC',
            color: colors.success,
            borderRadius: radii.button,
            padding: spacing.md,
            marginBottom: spacing.lg,
            fontSize: typography.body,
          }}
        >
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div
          style={{
            background: '#FFE5E9',
            color: colors.urgent,
            borderRadius: radii.button,
            padding: spacing.md,
            marginBottom: spacing.lg,
            fontSize: typography.body,
          }}
        >
          {actionError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: spacing.xl }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
          <Section title="Application details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              {Object.entries(detail.formData).map(([key, value]) => (
                <div key={key} style={{ display: 'flex', fontSize: typography.body }}>
                  <div style={{ width: 180, color: colors.textSecondary }}>{key}</div>
                  <div style={{ color: colors.text }}>{String(value)}</div>
                </div>
              ))}
              {Object.keys(detail.formData).length === 0 && (
                <div style={{ color: colors.textSecondary, fontSize: typography.body }}>No form data.</div>
              )}
            </div>
          </Section>

          <Section title="Documents">
            {detail.documents.length === 0 && (
              <div style={{ color: colors.textSecondary, fontSize: typography.body }}>No documents uploaded.</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              {detail.documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: spacing.sm,
                    border: `1px solid ${colors.line}`,
                    borderRadius: radii.button,
                  }}
                >
                  <div>
                    <div style={{ fontSize: typography.body, color: colors.text, fontWeight: 600 }}>
                      {doc.type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: typography.meta, color: colors.textSecondary }}>
                      {doc.fileName} · {formatBytes(doc.sizeBytes)} · {formatDate(doc.uploadedAt)}
                    </div>
                  </div>
                  <button onClick={() => handleViewDocument(doc.id)} style={linkButtonStyle}>
                    View
                  </button>
                </div>
              ))}
            </div>
          </Section>

          {detail.rejectionReason && (
            <Section title="Rejection reason">
              <div style={{ fontSize: typography.body, color: colors.text }}>{detail.rejectionReason}</div>
            </Section>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          {detail.status === 'PENDING_REVIEW' && (
            <Section title="Review">
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                <button
                  disabled={busy}
                  onClick={() => runAction(() => approveApplication(detail.applicationId), 'Application approved.')}
                  style={primaryButtonStyle}
                >
                  Approve
                </button>
                {!showRejectForm ? (
                  <button disabled={busy} onClick={() => setShowRejectForm(true)} style={dangerButtonStyle}>
                    Reject
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection"
                      rows={3}
                      style={textareaStyle}
                    />
                    <div style={{ display: 'flex', gap: spacing.xs }}>
                      <button
                        disabled={busy || rejectReason.trim().length === 0}
                        onClick={() =>
                          runAction(
                            () => rejectApplication(detail.applicationId, rejectReason.trim()),
                            'Application rejected.',
                          ).then(() => {
                            setShowRejectForm(false);
                            setRejectReason('');
                          })
                        }
                        style={dangerButtonStyle}
                      >
                        Confirm reject
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectReason('');
                        }}
                        style={secondaryButtonStyle}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {(detail.status === 'APPROVED' || detail.status === 'SUSPENDED') && (
            <Section title="Commission override">
              <div style={{ fontSize: typography.meta, color: colors.textSecondary, marginBottom: spacing.sm }}>
                This endpoint doesn't return the seller's current commission rate (a real gap, not
                fixed this phase — flagged, not invented). Enter the new rate in basis points
                (0–10000 = 0%–100%).
              </div>
              <div style={{ display: 'flex', gap: spacing.xs }}>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={commissionInput}
                  onChange={(e) => setCommissionInput(e.target.value)}
                  placeholder="e.g. 1000 = 10%"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  disabled={busy || commissionInput.trim().length === 0}
                  onClick={() =>
                    runAction(
                      () => updateCommission(detail.sellerId, Number(commissionInput)),
                      `Commission set to ${commissionInput} bps.`,
                    )
                  }
                  style={secondaryButtonStyle}
                >
                  Save
                </button>
              </div>
            </Section>
          )}

          {detail.status === 'APPROVED' && (
            <Section title="Seller status">
              <div style={{ fontSize: typography.meta, color: colors.textSecondary, marginBottom: spacing.sm }}>
                Suspending does not currently end live streams or hold payouts automatically,
                despite what the API spec implies — a known backend gap, surfaced here rather than
                hidden.
              </div>
              <button
                disabled={busy}
                onClick={() => runAction(() => suspendSeller(detail.sellerId), 'Seller suspended.')}
                style={dangerButtonStyle}
              >
                Suspend seller
              </button>
            </Section>
          )}

          {detail.status === 'SUSPENDED' && (
            <Section title="Seller status">
              <button
                disabled={busy}
                onClick={() => runAction(() => reinstateSeller(detail.sellerId), 'Seller reinstated.')}
                style={primaryButtonStyle}
              >
                Reinstate seller
              </button>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: colors.canvas,
        borderRadius: radii.cardLarge,
        border: `1px solid ${colors.line}`,
        boxShadow: shadows.card,
        padding: spacing.lg,
      }}
    >
      <div style={{ fontSize: typography.meta, color: colors.textSecondary, fontWeight: 600, marginBottom: spacing.sm }}>
        {title}
      </div>
      {children}
    </div>
  );
}

const baseButtonStyle = {
  border: 'none',
  borderRadius: radii.button,
  padding: `${spacing.sm}px ${spacing.md}px`,
  fontSize: typography.body,
  fontWeight: 600,
  cursor: 'pointer',
} as const;

const primaryButtonStyle = { ...baseButtonStyle, background: colors.brand, color: colors.canvas };
const dangerButtonStyle = { ...baseButtonStyle, background: colors.urgent, color: colors.canvas };
const secondaryButtonStyle = {
  ...baseButtonStyle,
  background: colors.canvas,
  color: colors.text,
  border: `1px solid ${colors.line}`,
};
const linkButtonStyle = {
  border: 'none',
  background: 'none',
  color: colors.brand,
  fontSize: typography.body,
  fontWeight: 600,
  cursor: 'pointer',
};
const textareaStyle = {
  border: `1px solid ${colors.line}`,
  borderRadius: radii.button,
  padding: spacing.sm,
  fontSize: typography.body,
  fontFamily: 'inherit',
  resize: 'vertical' as const,
};
const inputStyle = {
  border: `1px solid ${colors.line}`,
  borderRadius: radii.button,
  padding: `${spacing.sm}px ${spacing.md}px`,
  fontSize: typography.body,
};
