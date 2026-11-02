import { z } from 'zod';

export const RegisterDeviceSchema = z.object({
  pushToken: z.string().trim().min(1).max(512),
  platform: z.enum(['IOS', 'ANDROID', 'WEB']),
});

export type RegisterDeviceDto = z.infer<typeof RegisterDeviceSchema>;
