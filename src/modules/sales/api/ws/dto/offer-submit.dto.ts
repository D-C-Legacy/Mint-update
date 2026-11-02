import { z } from 'zod';

export const OfferSubmitSchema = z.object({
  saleId: z.string().min(1),
  amount: z.number().int().positive().transform((n) => BigInt(n)),
  clientRef: z.string().min(1).max(64),
});

export type OfferSubmitDto = z.infer<typeof OfferSubmitSchema>;
