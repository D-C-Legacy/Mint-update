import { z } from 'zod';

export const ListAuditLogQuerySchema = z.object({
  actorUserId: z.string().optional(),
  targetType: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListAuditLogQueryDto = z.infer<typeof ListAuditLogQuerySchema>;
