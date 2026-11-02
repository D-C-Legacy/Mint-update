import { z } from 'zod';

export const SubmitOfferSchema = z.object({
  amount: z.number().int().positive().transform((n) => BigInt(n)),
  clientRef: z.string().min(1).max(64),
});

export type SubmitOfferDto = z.infer<typeof SubmitOfferSchema>;
