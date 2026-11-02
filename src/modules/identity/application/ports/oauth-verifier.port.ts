// One DI token per provider (GOOGLE_OAUTH_VERIFIER / APPLE_OAUTH_VERIFIER) — each adapter only
// ever verifies its own provider's tokens, so the use case picks the right one by `provider`
// rather than this interface branching internally on it.
export const GOOGLE_OAUTH_VERIFIER = Symbol('GoogleOAuthVerifierPort');
export const APPLE_OAUTH_VERIFIER = Symbol('AppleOAuthVerifierPort');

// "native": the id token came straight from the device SDK (expo-auth-session /
// expo-apple-authentication), audience = the app's own client id (Google) or bundle id (Apple).
// "web": the id token came back from the backend's own authorization-code exchange with the
// provider, audience = the web client id (Google) or Services ID (Apple). Same provider, two
// different valid audiences — context picks which one a verifier checks against.
export type OAuthVerifyContext = 'native' | 'web';

export interface VerifiedOAuthClaims {
  readonly providerId: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly name: string | null;
}

export interface OAuthVerifierPort {
  verify(idToken: string, context: OAuthVerifyContext): Promise<VerifiedOAuthClaims>;
}
