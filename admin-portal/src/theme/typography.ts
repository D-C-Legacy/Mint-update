// Hand-synced from frontend/src/theme/typography.ts — see colors.ts's note. `fontFamilies`
// is adapted for web (CSS font-family stack via a Google Fonts <link>, not RN's
// per-weight-name loading) rather than copied verbatim; `textMetrics` is unchanged, pure math.
export const typography = {
  display: 48,
  title: 32,
  section: 22,
  product: 17,
  body: 15,
  meta: 13,
};

export const fontFamilies = {
  regular: "'Inter', sans-serif",
  semibold: "'Inter', sans-serif",
  bold: "'Inter', sans-serif",
} as const;

export function textMetrics(size: number) {
  if (size >= 20) {
    return { letterSpacing: -0.4, lineHeight: Math.round(size * 1.2) };
  }
  if (size <= 12) {
    return { letterSpacing: 0.2, lineHeight: Math.round(size * 1.4) };
  }
  return { letterSpacing: 0, lineHeight: Math.round(size * 1.45) };
}
