import { z } from 'zod';

// 05-API-SPEC.md §8: `POST /orders/:id/ship` body is `{ carrier, trackingNumber }`.
export const ShipOrderSchema = z.object({
  carrier: z.string().trim().min(1).max(50),
  trackingNumber: z.string().trim().min(1).max(100),
});

export type ShipOrderDto = z.infer<typeof ShipOrderSchema>;
