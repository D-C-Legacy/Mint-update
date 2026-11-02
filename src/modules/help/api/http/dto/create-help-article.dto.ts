import { z } from 'zod';

export const CreateHelpArticleSchema = z
  .object({
    category: z.string().trim().min(1).max(60),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(10000),
    sortOrder: z.number().int().default(0),
  })
  .strict();

export type CreateHelpArticleDto = z.infer<typeof CreateHelpArticleSchema>;
