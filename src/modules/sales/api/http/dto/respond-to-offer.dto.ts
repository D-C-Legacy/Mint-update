import { z } from 'zod';

export const RespondToOfferSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ACCEPT') }),
  z.object({ action: z.literal('REJECT') }),
  z.object({
    action: z.literal('COUNTER'),
    counterAmount: z.number().int().positive().transform((n) => BigInt(n)),
  }),
]);

export type RespondToOfferDto = z.infer<typeof RespondToOfferSchema>;
