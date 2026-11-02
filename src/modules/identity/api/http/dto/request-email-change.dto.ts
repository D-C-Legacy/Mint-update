import { z } from 'zod';

export const RequestEmailChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newEmail: z.string().email(),
});

export type RequestEmailChangeDto = z.infer<typeof RequestEmailChangeSchema>;
