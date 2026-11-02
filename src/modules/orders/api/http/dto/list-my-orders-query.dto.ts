import { z } from 'zod';

export const ListMyOrdersQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListMyOrdersQueryDto = z.infer<typeof ListMyOrdersQuerySchema>;
