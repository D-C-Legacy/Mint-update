import { z } from 'zod';

export const SendMessageSchema = z.object({
  sessionId: z.string().min(1),
  body: z.string().min(1).max(500),
  clientRef: z.string().max(64),
});
export type SendMessageDto = z.infer<typeof SendMessageSchema>;
