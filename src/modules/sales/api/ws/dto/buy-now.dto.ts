import { z } from 'zod';

// 06-REALTIME-AND-CONCURRENCY.md §2 documents `quantity` on this inbound event, but no Sale
// row supports partial multi-buyer fulfillment (see BuyNowUseCase's own note) — accepted here
// for shape-compatibility with the doc but intentionally unused; the sale's own fixed quantity
// is always what's actually purchased.
export const BuyNowSchema = z.object({
  saleId: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  clientRef: z.string().min(1).max(64),
});

export type BuyNowDto = z.infer<typeof BuyNowSchema>;
