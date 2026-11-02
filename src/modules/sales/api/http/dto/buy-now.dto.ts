import { z } from 'zod';

export const BuyNowSchema = z.object({
  clientRef: z.string().min(1).max(64),
});

export type BuyNowDto = z.infer<typeof BuyNowSchema>;
