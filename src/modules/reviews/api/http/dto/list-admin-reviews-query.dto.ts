import { z } from 'zod';

export const ListAdminReviewsQuerySchema = z.object({
  status: z.enum(['VISIBLE', 'HIDDEN']).optional(),
  sellerId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListAdminReviewsQueryDto = z.infer<typeof ListAdminReviewsQuerySchema>;
