import { z } from 'zod';

export const PlaceBidSchema = z.object({
  amount: z.number().int().positive().transform((n) => BigInt(n)),
  clientRef: z.string().min(1).max(64),
});

export type PlaceBidDto = z.infer<typeof PlaceBidSchema>;
