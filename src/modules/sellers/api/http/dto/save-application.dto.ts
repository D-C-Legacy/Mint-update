import { z } from 'zod';

export const SaveApplicationSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'BUSINESS']),
  legalName: z.string().min(1).max(200),
  displayName: z.string().min(1).max(100),
  formData: z.record(z.unknown()),
});

export type SaveApplicationDto = z.infer<typeof SaveApplicationSchema>;
