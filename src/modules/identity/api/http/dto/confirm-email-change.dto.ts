import { z } from 'zod';

export const ConfirmEmailChangeSchema = z.object({
  token: z.string().min(1),
});

export type ConfirmEmailChangeDto = z.infer<typeof ConfirmEmailChangeSchema>;
