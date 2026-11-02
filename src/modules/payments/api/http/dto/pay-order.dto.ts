import { z } from 'zod';

// No doc gives a request body shape for POST /orders/:id/pay (05-API-SPEC.md §9 only names the
// Idempotency-Key header) — `paymentMethodId` is optional, matching PayOrderCommand's own
// optional field, zero-ambiguity additive per its doc comment ("use whatever's already on file
// if omitted" is PayOrderUseCase's own job, not this DTO's).
export const PayOrderSchema = z.object({
  paymentMethodId: z.string().min(1).max(255).optional(),
});

export type PayOrderDto = z.infer<typeof PayOrderSchema>;
