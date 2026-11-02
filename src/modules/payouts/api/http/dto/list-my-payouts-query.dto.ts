import { z } from 'zod';

export const ListMyPayoutsQuerySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'REVERSED', 'HELD']).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListMyPayoutsQueryDto = z.infer<typeof ListMyPayoutsQuerySchema>;
