import { z } from 'zod';

export const RequestAvatarUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
});

export type RequestAvatarUploadDto = z.infer<typeof RequestAvatarUploadSchema>;
