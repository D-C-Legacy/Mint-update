import { z } from 'zod';

export const VerifyEmailSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});

export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>;
