import { z } from 'zod';

export const UpdateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(2000).optional(),
  bannerKey: z.string().min(1).max(1024).optional(),
});

export type UpdateChannelDto = z.infer<typeof UpdateChannelSchema>;
