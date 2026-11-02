export const APP_NAME = 'Swish';
// The public web app URL, shared when a viewer shares a live show. The real production domain
// (prompt.md §13). A per-stream deep link needs the web URL routing that doesn't exist yet, so the
// app URL is what gets shared for now.
export const APP_WEB_URL = 'https://swishfy.com';
export const MOCK_CONFIG = {
  initializationMs: 700,
  submissionMs: 450,
  toastMs: 3200,
  otpSeconds: 30,
  otpCode: '123456',
} as const;
export const ONBOARDING = [
  {
    title: 'Shop live. Discover differently.',
    description: 'Discover products through live sellers and communities.',
    icon: 'storefront-outline',
  },
  {
    title: 'Bid in real time.',
    description: 'Join auctions, place bids and win products while watching live.',
    icon: 'hammer-outline',
  },
  {
    title: 'Follow the sellers you love.',
    description: 'Build your feed around sellers, categories and products you care about.',
    icon: 'heart-outline',
  },
] as const;
