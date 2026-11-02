import { z } from 'zod';

export const ListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListQueryDto = z.infer<typeof ListQuerySchema>;
