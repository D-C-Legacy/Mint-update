import { z } from 'zod';

export const ToggleAutoQueueSchema = z.object({
  enabled: z.boolean(),
});

export type ToggleAutoQueueDto = z.infer<typeof ToggleAutoQueueSchema>;
