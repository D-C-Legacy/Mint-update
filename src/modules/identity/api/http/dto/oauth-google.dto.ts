import { z } from 'zod';

// Native sign-in: expo-auth-session hands this id_token to the client directly.
export const OAuthGoogleSchema = z.object({
  idToken: z.string().min(1),
});

export type OAuthGoogleDto = z.infer<typeof OAuthGoogleSchema>;
