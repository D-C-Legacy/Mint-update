import { z } from 'zod';

export const ListPublicChannelsQuerySchema = z.object({
  sellerId: z.string().min(1).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListPublicChannelsQueryDto = z.infer<typeof ListPublicChannelsQuerySchema>;
