import { z } from 'zod';

const money = z
  .number()
  .int()
  .positive()
  .transform((n) => BigInt(n));

export const FeatureQueueItemSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('AUCTION'),
    currency: z.string().length(3),
    startAmount: money,
    durationSeconds: z.number().int().positive().optional(),
  }),
  z.object({
    mode: z.literal('BUY_NOW'),
    currency: z.string().length(3),
    price: money,
    quantity: z.number().int().positive(),
  }),
  z.object({
    mode: z.literal('OFFER'),
    currency: z.string().length(3),
  }),
]);

export type FeatureQueueItemDto = z.infer<typeof FeatureQueueItemSchema>;
