import { z } from 'zod';

export const ListNotificationsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListNotificationsQueryDto = z.infer<typeof ListNotificationsQuerySchema>;
