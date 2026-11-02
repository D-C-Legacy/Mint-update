import { z } from 'zod';
import { ProductConditionSchema } from './create-product.dto';

export const UpdateProductSchema = z.object({
  categoryId: z.string().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  condition: ProductConditionSchema.optional(),
  quantity: z.number().int().nonnegative().optional(),
  weightGrams: z.number().int().positive().optional(),
});

export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
