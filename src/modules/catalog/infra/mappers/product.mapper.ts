import type { Product as PrismaProduct } from '@prisma/client';
import { Product } from '../../domain/entities/product.entity';

export function toDomainProduct(row: PrismaProduct): Product {
  return {
    id: row.id,
    sellerId: row.sellerId,
    categoryId: row.categoryId,
    title: row.title,
    description: row.description,
    condition: row.condition,
    status: row.status,
    quantity: row.quantity,
    reserved: row.reserved,
    weightGrams: row.weightGrams,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
