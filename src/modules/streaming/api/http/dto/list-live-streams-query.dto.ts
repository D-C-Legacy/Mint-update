import { z } from 'zod';

export const ListLiveStreamsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListLiveStreamsQueryDto = z.infer<typeof ListLiveStreamsQuerySchema>;
