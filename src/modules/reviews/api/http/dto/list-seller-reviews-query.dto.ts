import { z } from 'zod';

export const ListSellerReviewsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListSellerReviewsQueryDto = z.infer<typeof ListSellerReviewsQuerySchema>;
