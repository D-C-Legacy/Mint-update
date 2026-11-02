import { z } from 'zod';

export const ListBidsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListBidsQueryDto = z.infer<typeof ListBidsQuerySchema>;
