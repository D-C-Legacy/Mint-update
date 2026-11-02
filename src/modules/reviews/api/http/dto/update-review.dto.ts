import { z } from 'zod';

export const UpdateReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    body: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

export type UpdateReviewDto = z.infer<typeof UpdateReviewSchema>;
