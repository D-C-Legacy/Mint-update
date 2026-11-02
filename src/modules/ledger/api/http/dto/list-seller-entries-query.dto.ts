import { z } from 'zod';

export const ListSellerEntriesQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListSellerEntriesQueryDto = z.infer<typeof ListSellerEntriesQuerySchema>;
