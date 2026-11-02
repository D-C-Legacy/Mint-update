import { Share } from 'react-native';

// Share a live show. Native uses the OS share sheet (react-native's Share). The web build gets
// `share.web.ts` (Web Share API with a clipboard fallback). Both are fire-and-forget — a dismissed
// sheet or an unavailable API is not an error.
export async function shareStream(input: { title: string; url: string }): Promise<void> {
  try {
    await Share.share({ title: input.title, message: `${input.title}: ${input.url}` });
  } catch {
    // The user dismissed the sheet, or sharing isn't available on this device.
  }
}
