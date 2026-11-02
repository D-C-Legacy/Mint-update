import { z } from 'zod';

const money = z
  .number()
  .int()
  .positive()
  .transform((n) => BigInt(n));

export const SwitchSaleModeSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('BUY_NOW'),
    price: money,
    quantity: z.number().int().positive(),
  }),
  z.object({
    mode: z.literal('AUCTION'),
    startAmount: money,
    durationSeconds: z.number().int().positive().optional(),
  }),
  z.object({
    mode: z.literal('OFFER'),
  }),
]);

export type SwitchSaleModeDto = z.infer<typeof SwitchSaleModeSchema>;
