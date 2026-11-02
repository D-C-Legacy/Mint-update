import { z } from 'zod';

export const ListFollowingQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListFollowingQueryDto = z.infer<typeof ListFollowingQuerySchema>;
