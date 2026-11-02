import { z } from 'zod';

export const CancelOrderSchema = z.object({
  reason: z.string().trim().min(1).max(200).optional(),
});

export type CancelOrderDto = z.infer<typeof CancelOrderSchema>;
