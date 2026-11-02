import { z } from 'zod';

export const RespondToReviewSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
  })
  .strict();

export type RespondToReviewDto = z.infer<typeof RespondToReviewSchema>;
