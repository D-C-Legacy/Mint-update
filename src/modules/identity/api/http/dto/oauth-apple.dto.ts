import { z } from 'zod';

// Native sign-in: expo-apple-authentication hands this identityToken (plus, on the account's
// first-ever authorization only, a real name) to the client directly.
export const OAuthAppleSchema = z.object({
  identityToken: z.string().min(1),
  fullName: z.string().min(1).optional(),
});

export type OAuthAppleDto = z.infer<typeof OAuthAppleSchema>;
