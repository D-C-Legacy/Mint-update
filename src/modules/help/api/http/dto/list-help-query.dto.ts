import { z } from 'zod';

export const ListHelpQuerySchema = z.object({
  category: z.string().optional(),
});

export type ListHelpQueryDto = z.infer<typeof ListHelpQuerySchema>;
