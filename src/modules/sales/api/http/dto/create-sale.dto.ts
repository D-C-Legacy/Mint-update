import { z } from 'zod';

const money = z.number().int().positive().transform((n) => BigInt(n));

export const CreateSaleSchema = z.discriminatedUnion('mode', [
  z.object({
    sessionId: z.string().min(1),
    productId: z.string().min(1),
    mode: z.literal('AUCTION'),
    currency: z.string().length(3),
    startAmount: money,
    durationSeconds: z.number().int().positive().optional(),
  }),
  z.object({
    sessionId: z.string().min(1),
    productId: z.string().min(1),
    mode: z.literal('BUY_NOW'),
    currency: z.string().length(3),
    price: money,
    quantity: z.number().int().positive(),
  }),
  z.object({
    sessionId: z.string().min(1),
    productId: z.string().min(1),
    mode: z.literal('OFFER'),
    currency: z.string().length(3),
  }),
]);

export type CreateSaleDto = z.infer<typeof CreateSaleSchema>;
