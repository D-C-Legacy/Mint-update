import { z } from 'zod';

export const CreateReportSchema = z
  .object({
    targetType: z.enum(['REVIEW', 'MESSAGE']),
    targetId: z.string().min(1),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export type CreateReportDto = z.infer<typeof CreateReportSchema>;
