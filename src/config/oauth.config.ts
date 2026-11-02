import { env } from './env';

// Every field here is optional at the env layer (see env.schema.ts) — a missing provider's
// fields all come through as undefined, which the verifiers in
// src/modules/identity/infra/oauth/ treat as "not configured yet" (OAuthProviderNotConfiguredError),
// not a crash.
export const oauthConfig = Object.freeze({
  google: {
    webClientId: env.GOOGLE_CLIENT_ID,
    webClientSecret: env.GOOGLE_CLIENT_SECRET,
    webRedirectUri: env.GOOGLE_REDIRECT_URI,
    iosClientId: env.GOOGLE_IOS_CLIENT_ID,
  },
  apple: {
    servicesId: env.APPLE_SERVICES_ID,
    teamId: env.APPLE_TEAM_ID,
    keyId: env.APPLE_KEY_ID,
    // Stored in .env with literal "\n" sequences (PEM can't hold real newlines in a single env
    // var) — restored here so jsonwebtoken gets a real multi-line PEM.
    privateKey: env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    redirectUri: env.APPLE_REDIRECT_URI,
    bundleId: env.APPLE_BUNDLE_ID,
  },
});

export type OAuthConfig = typeof oauthConfig;
