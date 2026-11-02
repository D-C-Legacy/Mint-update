export const typography = {
  display: 48,
  title: 32,
  section: 22,
  product: 17,
  body: 15,
  meta: 13,
};

// Inter, loaded in App.tsx via @expo-google-fonts/inter. Three weights so the app reads as one family.
// On Android a custom font is chosen by its name, not by fontWeight, so each weight is its own family.
export const fontFamilies = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

// Headings get tighter tracking and tighter line height; small text gets slightly looser tracking.
// Body text keeps the default tracking with a roomier line height for reading.
export function textMetrics(size: number) {
  if (size >= 20) {
    return { letterSpacing: -0.4, lineHeight: Math.round(size * 1.2) };
  }
  if (size <= 12) {
    return { letterSpacing: 0.2, lineHeight: Math.round(size * 1.4) };
  }
  return { letterSpacing: 0, lineHeight: Math.round(size * 1.45) };
}
