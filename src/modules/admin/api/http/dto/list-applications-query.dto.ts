import { z } from 'zod';

export const ListApplicationsQuerySchema = z.object({
  decision: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListApplicationsQueryDto = z.infer<typeof ListApplicationsQuerySchema>;
