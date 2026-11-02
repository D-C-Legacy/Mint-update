import { z } from 'zod';

export const CreateReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    body: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

export type CreateReviewDto = z.infer<typeof CreateReviewSchema>;
