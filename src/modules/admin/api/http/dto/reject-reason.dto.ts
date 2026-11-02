import { z } from 'zod';

export const RejectReasonSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export type RejectReasonDto = z.infer<typeof RejectReasonSchema>;
