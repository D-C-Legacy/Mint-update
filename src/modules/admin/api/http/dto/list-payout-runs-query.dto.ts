import { z } from 'zod';

export const ListPayoutRunsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListPayoutRunsQueryDto = z.infer<typeof ListPayoutRunsQuerySchema>;
