import { z } from 'zod';

export const ListPublicSalesQuerySchema = z.object({
  mode: z.enum(['AUCTION', 'BUY_NOW', 'OFFER']).optional(),
  productId: z.string().min(1).optional(),
  status: z.enum(['OPEN', 'CLOSING', 'RESOLVED', 'CANCELLED', 'EXPIRED']).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListPublicSalesQueryDto = z.infer<typeof ListPublicSalesQuerySchema>;

export const ListMyBidsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListMyBidsQueryDto = z.infer<typeof ListMyBidsQuerySchema>;
