import { api, tokenStore } from './index';

// Shape of GET /v1/me (05-API-SPEC.md §2). Only fields the backend stores.
export type CurrentUser = {
  id: string;
  email: string;
  phone: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  emailVerifiedAt: string | null;
  deletionScheduledAt: string | null;
};

export function registerAccount(input: { email: string; password: string; displayName: string }) {
  return api.request<{ user: { id: string; displayName: string; role: string } }>(
    '/auth/register',
    {
      method: 'POST',
      body: input,
      auth: false,
    },
  );
}

// The token is the one printed in the API log locally (no email provider is configured).
export function verifyEmailToken(token: string) {
  return api.request<{ verified: true }>('/auth/verify-email', {
    method: 'POST',
    body: { token },
    auth: false,
  });
}

// PATCH /v1/me. `avatarKey` (a storage key from requestAvatarUpload below) and `phone` are both
// optional: omit to leave unchanged, or pass `null` to clear either one.
export function updateProfile(input: {
  displayName: string;
  avatarKey?: string | null;
  phone?: string | null;
}) {
  return api.request<CurrentUser>('/me', { method: 'PATCH', body: input });
}

export type AvatarUploadSlot = { uploadUrl: string; storageKey: string; expiresIn: number };

// POST /v1/me/avatar/upload-url: mints a presigned S3 PUT URL. The caller uploads the file bytes
// directly to `uploadUrl` (not through this API), then passes `storageKey` back as `avatarKey` to
// updateProfile() to actually attach it.
export function requestAvatarUpload(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  return api.request<AvatarUploadSlot>('/me/avatar/upload-url', { method: 'POST', body: input });
}

// Signs every other session out and returns fresh tokens, which are stored so this device stays in.
export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  const data = await api.request<{ accessToken: string; refreshToken: string }>(
    '/auth/change-password',
    { method: 'POST', body: input },
  );
  tokenStore.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
}

// Step 1 of 2 for changing email: checks the current password, sends a confirm code to the new
// address plus a heads-up to the old one. Nothing on the account changes yet.
export function requestEmailChange(input: { currentPassword: string; newEmail: string }) {
  return api.request<{ sent: true }>('/auth/request-email-change', { method: 'POST', body: input });
}

// Step 2: the code from the new address's email. Same as changePassword, signs every other
// session out and stores fresh tokens for this device.
export async function confirmEmailChange(token: string) {
  const data = await api.request<{ accessToken: string; refreshToken: string }>(
    '/auth/confirm-email-change',
    { method: 'POST', body: { token } },
  );
  tokenStore.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
}

// Locally no email is sent: the reset token is printed in the API log (`password reset email to`).
export function requestPasswordReset(email: string) {
  return api.request<{ sent: true }>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
    auth: false,
  });
}

export function resetPassword(input: { token: string; newPassword: string }) {
  return api.request<{ reset: true }>('/auth/reset-password', {
    method: 'POST',
    body: input,
    auth: false,
  });
}

export function signInWithPassword(email: string, password: string) {
  return api.login(email, password);
}

export function fetchCurrentUser() {
  return api.request<CurrentUser>('/me');
}

// Apple App Store guideline 5.1.1(v) account-deletion feature. Server re-validates `confirm`
// itself (RequestAccountDeletionSchema) rather than trusting the client's "type DELETE" step
// alone. Blocked (unpaid balance / unresolved orders) comes back as a 409 with
// `error.details.reasons: string[]` — see describeApiError/ApiError for how callers read that.
export function requestAccountDeletion() {
  return api.request<{ scheduledFor: string }>('/me/delete-account', {
    method: 'POST',
    body: { confirm: 'DELETE' },
  });
}

export function cancelAccountDeletion() {
  return api.request<{ cancelled: true }>('/me/delete-account/cancel', { method: 'POST' });
}

// Revokes the session on the server when possible. Local tokens are cleared either way.
export async function signOut(): Promise<void> {
  const current = tokenStore.get();
  try {
    if (current) {
      await api.request('/auth/logout', {
        method: 'POST',
        body: { refreshToken: current.refreshToken },
      });
    }
  } catch {
    // Server-side revocation is best effort; the local session is cleared below regardless.
  } finally {
    tokenStore.clear();
  }
}
