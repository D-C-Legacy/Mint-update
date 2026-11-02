import { z } from 'zod';

export const ResolveReportSchema = z
  .object({
    status: z.enum(['RESOLVED', 'DISMISSED']),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type ResolveReportDto = z.infer<typeof ResolveReportSchema>;
