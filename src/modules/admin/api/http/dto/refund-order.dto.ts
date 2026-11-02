import { z } from 'zod';

export const RefundOrderSchema = z.object({
  amount: z.number().int().positive().transform((n) => BigInt(n)),
  reason: z.string().min(1).max(1000),
});

export type RefundOrderDto = z.infer<typeof RefundOrderSchema>;
