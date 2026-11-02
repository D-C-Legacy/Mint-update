import { z } from 'zod';

const money = z
  .number()
  .int()
  .positive()
  .transform((n) => BigInt(n));

// Mirrors FeatureQueueItemSchema's own discriminated union — pricing moved here, to add-to-queue
// time, so the auto-advance job has something to feature with (round5 §5, 26 Oct 2026).
export const AddQueueItemSchema = z.discriminatedUnion('mode', [
  z.object({
    productId: z.string().min(1),
    mode: z.literal('AUCTION'),
    startAmount: money,
  }),
  z.object({
    productId: z.string().min(1),
    mode: z.literal('BUY_NOW'),
    price: money,
    quantity: z.number().int().positive(),
  }),
  z.object({
    productId: z.string().min(1),
    mode: z.literal('OFFER'),
  }),
]);

export type AddQueueItemDto = z.infer<typeof AddQueueItemSchema>;
