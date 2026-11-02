import { z } from 'zod';

export const UpdateHelpArticleSchema = z
  .object({
    category: z.string().trim().min(1).max(60).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(10000).optional(),
    sortOrder: z.number().int().optional(),
    isPublished: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export type UpdateHelpArticleDto = z.infer<typeof UpdateHelpArticleSchema>;
