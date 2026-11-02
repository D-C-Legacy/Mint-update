import { z } from 'zod';

export const StartConversationSchema = z
  .object({
    sellerId: z.string().min(1),
    body: z.string().trim().min(1).max(2000),
  })
  .strict();

export type StartConversationDto = z.infer<typeof StartConversationSchema>;
