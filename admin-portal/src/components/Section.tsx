import type { ReactNode } from 'react';
import { colors, radii, shadows, spacing, typography } from '../theme';

export function Section({ title, children }: { title: string; children: ReactNode }) {
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
