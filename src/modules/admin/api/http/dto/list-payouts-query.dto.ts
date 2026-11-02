import { z } from 'zod';

// Unlike list-orders-query.dto.ts, `status` is required, not optional — the admin-portal plan's
// draft said to mirror that file's shape, but PayoutRepositoryPort.findByStatus (unlike orders'
// equivalent) has no "all statuses" mode, so there's no "All" value this route could honor. See
// PayoutsService.listPayouts's own comment.
export const ListPayoutsQuerySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'REVERSED', 'HELD']),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListPayoutsQueryDto = z.infer<typeof ListPayoutsQuerySchema>;
