import { colors, radii, spacing, typography } from '../theme';

// Generic status pill, reused across Applications/Orders/Payouts/Streams (Phases 1-4) — one
// color mapping kept here instead of duplicated per page.
const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  PENDING: { fg: colors.warning, bg: '#FDF2DD' },
  PENDING_REVIEW: { fg: colors.warning, bg: '#FDF2DD' },
  APPROVED: { fg: colors.success, bg: '#E3F6EC' },
  REJECTED: { fg: colors.urgent, bg: '#FFE5E9' },
  SUSPENDED: { fg: colors.urgent, bg: '#FFE5E9' },
  DRAFT: { fg: colors.textSecondary, bg: colors.softCanvas },
};

export function StatusBadge({ status }: { status: string }) {
  const palette = STATUS_COLORS[status] ?? { fg: colors.textSecondary, bg: colors.softCanvas };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: `2px ${spacing.sm}px`,
        borderRadius: radii.pill,
        background: palette.bg,
        color: palette.fg,
        fontSize: typography.meta,
        fontWeight: 600,
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
