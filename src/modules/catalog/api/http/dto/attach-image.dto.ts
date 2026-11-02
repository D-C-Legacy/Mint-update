import { z } from 'zod';

export const AttachImageSchema = z.object({
  storageKey: z.string().min(1).max(1024),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export type AttachImageDto = z.infer<typeof AttachImageSchema>;
