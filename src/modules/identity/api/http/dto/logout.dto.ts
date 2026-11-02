import { z } from 'zod';

export const LogoutSchema = z.object({
  refreshToken: z.string().min(1),
});

export type LogoutDto = z.infer<typeof LogoutSchema>;
