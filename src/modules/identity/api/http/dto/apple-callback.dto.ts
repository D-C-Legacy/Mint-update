import { z } from 'zod';

// Apple's form_post response to GET /auth/apple (response_mode=form_post is mandatory once
// name/email scopes are requested). `user` is a JSON-encoded string, present only on the
// account's very first authorization for this Services ID: `{"name":{"firstName","lastName"},
// "email":"..."}`. Every later sign-in omits it entirely.
export const AppleCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
  user: z.string().optional(),
});

export type AppleCallbackDto = z.infer<typeof AppleCallbackSchema>;

export function extractAppleFullName(userField: string | undefined): string | undefined {
  if (!userField) return undefined;
  try {
    const parsed = JSON.parse(userField) as { name?: { firstName?: string; lastName?: string } };
    const full = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(' ').trim();
    return full.length > 0 ? full : undefined;
  } catch {
    return undefined;
  }
}
