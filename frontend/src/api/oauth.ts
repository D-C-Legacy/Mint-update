import { api, tokenStore } from './index';
import type { AuthResult } from './client';

// Same envelope every other sign-in path returns (login, register+verify, confirmEmailChange) —
// stores the tokens exactly like api.login() does, so AuthProvider's post-sign-in steps
// (fetchCurrentUser, setState('authenticated')) work unchanged for every entry point.
async function storeAndReturn(result: AuthResult): Promise<AuthResult> {
  tokenStore.set({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  return result;
}

// Native Google sign-in: the idToken comes straight from expo-auth-session on the device.
export async function signInWithGoogleIdToken(idToken: string): Promise<AuthResult> {
  const data = await api.request<AuthResult>('/auth/google', {
    method: 'POST',
    body: { idToken },
    auth: false,
  });
  return storeAndReturn(data);
}

// Native Apple sign-in: identityToken + (first-authorization-only) fullName come straight from
// expo-apple-authentication on the device.
export async function signInWithAppleIdentityToken(
  identityToken: string,
  fullName?: string,
): Promise<AuthResult> {
  const data = await api.request<AuthResult>('/auth/apple', {
    method: 'POST',
    body: { identityToken, ...(fullName ? { fullName } : {}) },
    auth: false,
  });
  return storeAndReturn(data);
}

// Web sign-in's final step: the backend already completed the provider round trip and
// redirected the browser here with a one-time code (see auth.controller.ts's
// finishGoogleWeb/finishAppleWeb) instead of putting real tokens in that redirect's URL.
export async function exchangeOAuthCode(code: string): Promise<AuthResult> {
  const data = await api.request<AuthResult>('/auth/exchange-code', {
    method: 'POST',
    body: { code },
    auth: false,
  });
  return storeAndReturn(data);
}
