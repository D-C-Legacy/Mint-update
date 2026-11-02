import { z } from 'zod';

export const RequestChannelBannerUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
});

export type RequestChannelBannerUploadDto = z.infer<typeof RequestChannelBannerUploadSchema>;
