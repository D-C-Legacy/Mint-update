import { z } from 'zod';

export const ListProductsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'SOLD', 'ARCHIVED']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListProductsQueryDto = z.infer<typeof ListProductsQuerySchema>;
