import { z } from 'zod';

export const CreateStreamSchema = z.object({
  title: z.string().min(1).max(200),
  scheduledFor: z.coerce.date().nullable().default(null),
});

export type CreateStreamDto = z.infer<typeof CreateStreamSchema>;
