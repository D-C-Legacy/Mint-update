// Web build of `share.ts`. Uses the Web Share API when the browser offers it (most mobile browsers
// and desktop Safari/Chrome), falling back to copying the URL to the clipboard.
export async function shareStream(input: { title: string; url: string }): Promise<void> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;

  if (nav?.share) {
    try {
      await nav.share({ title: input.title, text: input.title, url: input.url });
    } catch {
      // The user dismissed the sheet — not an error.
    }
    return;
  }

  try {
    await nav?.clipboard?.writeText(input.url);
  } catch {
    // Clipboard can be blocked (non-secure context, permissions); nothing to do.
  }
}
