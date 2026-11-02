import { z } from 'zod';

export const ListSellerOrdersQuerySchema = z.object({
  status: z
    .enum(['PENDING_PAYMENT', 'PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED'])
    .optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListSellerOrdersQueryDto = z.infer<typeof ListSellerOrdersQuerySchema>;
