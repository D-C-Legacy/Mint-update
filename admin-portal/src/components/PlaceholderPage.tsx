import { colors, spacing, radii, typography } from '../theme';

export function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div
      style={{
        background: colors.canvas,
        borderRadius: radii.cardLarge,
        border: `1px solid ${colors.line}`,
        padding: spacing.xxl,
      }}
    >
      <h1 style={{ fontSize: typography.section, color: colors.text, margin: 0 }}>{title}</h1>
      <p style={{ fontSize: typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>
        Not built yet — ships in {phase}.
      </p>
    </div>
  );
}
