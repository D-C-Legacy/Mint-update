import { z } from 'zod';

export const ListReportsQuerySchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListReportsQueryDto = z.infer<typeof ListReportsQuerySchema>;
