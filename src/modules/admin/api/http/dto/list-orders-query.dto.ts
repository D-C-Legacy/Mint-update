import { z } from 'zod';

export const ListOrdersQuerySchema = z.object({
  status: z
    .enum(['PENDING_PAYMENT', 'PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED'])
    .optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListOrdersQueryDto = z.infer<typeof ListOrdersQuerySchema>;
