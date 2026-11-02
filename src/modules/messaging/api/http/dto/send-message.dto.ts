import { z } from 'zod';

export const SendMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
  })
  .strict();

export type SendMessageDto = z.infer<typeof SendMessageSchema>;
