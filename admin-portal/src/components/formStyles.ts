// Shared button/input style objects for admin detail pages (Orders onward). Phase 1's
// ApplicationDetailPage.tsx defines its own copies predating this file — not refactored to
// reuse it, to keep this phase's diff scoped to what Phase 2 touches.
import type { CSSProperties } from 'react';
import { colors, radii, spacing, typography } from '../theme';

const baseButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: radii.button,
  padding: `${spacing.sm}px ${spacing.md}px`,
  fontSize: typography.body,
  fontWeight: 600,
  cursor: 'pointer',
};

export const primaryButtonStyle: CSSProperties = { ...baseButtonStyle, background: colors.brand, color: colors.canvas };
export const dangerButtonStyle: CSSProperties = { ...baseButtonStyle, background: colors.urgent, color: colors.canvas };
export const secondaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: colors.canvas,
  color: colors.text,
  border: `1px solid ${colors.line}`,
};

export const inputStyle: CSSProperties = {
  border: `1px solid ${colors.line}`,
  borderRadius: radii.button,
  padding: `${spacing.sm}px ${spacing.md}px`,
  fontSize: typography.body,
};

export const textareaStyle: CSSProperties = {
  border: `1px solid ${colors.line}`,
  borderRadius: radii.button,
  padding: spacing.sm,
  fontSize: typography.body,
  fontFamily: 'inherit',
  resize: 'vertical',
};
