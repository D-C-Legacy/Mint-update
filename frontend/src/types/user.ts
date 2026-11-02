// The signed-in user, from GET /v1/me. Only fields the backend stores; no handle or follower
// counts exist yet.
export type User = {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  avatarUrl: string | null;
  role: string;
  emailVerified: boolean;
  // Apple App Store guideline 5.1.1(v) account-deletion feature (28 Oct 2026). Non-null means a
  // deletion request is pending — RootNavigator gates the whole app shell on this.
  deletionScheduledAt: string | null;
};
export type AuthState = 'loading' | 'onboarding' | 'unauthenticated' | 'authenticated';
export type AuthPage = 'welcome' | 'sign-in' | 'sign-up' | 'forgot-password' | 'verification';
