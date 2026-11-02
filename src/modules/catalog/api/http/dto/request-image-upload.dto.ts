import { z } from 'zod';

export const RequestImageUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
});

export type RequestImageUploadDto = z.infer<typeof RequestImageUploadSchema>;
