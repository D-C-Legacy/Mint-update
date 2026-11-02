export const GOOGLE_OAUTH_CODE_EXCHANGER = Symbol('GoogleOAuthCodeExchangerPort');
export const APPLE_OAUTH_CODE_EXCHANGER = Symbol('AppleOAuthCodeExchangerPort');

// Trades a web-flow authorization `code` (from the provider's redirect back to our own
// /auth/<provider>/callback route) for that provider's id_token, per standard OAuth 2.0.
// Native sign-in never needs this — the device SDK hands the id_token straight to the client,
// which posts it directly to POST /auth/google or /auth/apple.
export interface OAuthCodeExchangerPort {
  exchange(code: string): Promise<{ idToken: string }>;
}
