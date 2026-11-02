import { z } from 'zod';

// Google's query-string redirect back to GET /auth/google/callback. `error` is present instead
// of `code` when the user declines consent on Google's own screen.
export const GoogleCallbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export type GoogleCallbackQueryDto = z.infer<typeof GoogleCallbackQuerySchema>;
