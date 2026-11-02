import { z } from 'zod';

export const ProductConditionSchema = z.enum(['NEW', 'LIKE_NEW', 'USED', 'FOR_PARTS']);

export const CreateProductSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  condition: ProductConditionSchema,
  quantity: z.number().int().positive(),
  weightGrams: z.number().int().positive().optional(),
});

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
