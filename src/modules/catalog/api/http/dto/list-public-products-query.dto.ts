import { z } from 'zod';

export const ListPublicProductsQuerySchema = z.object({
  categoryId: z.string().min(1).optional(),
  sellerId: z.string().min(1).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListPublicProductsQueryDto = z.infer<typeof ListPublicProductsQuerySchema>;
