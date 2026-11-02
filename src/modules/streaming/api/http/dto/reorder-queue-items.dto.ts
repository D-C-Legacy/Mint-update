import { z } from 'zod';

export const ReorderQueueItemsSchema = z.object({
  orderedItemIds: z.array(z.string().min(1)).min(1),
});

export type ReorderQueueItemsDto = z.infer<typeof ReorderQueueItemsSchema>;
