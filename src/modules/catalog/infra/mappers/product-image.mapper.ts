import type { ProductImage as PrismaProductImage } from '@prisma/client';
import { ProductImage } from '../../domain/entities/product-image.entity';

export function toDomainProductImage(row: PrismaProductImage): ProductImage {
  return {
    id: row.id,
    productId: row.productId,
    storageKey: row.storageKey,
    position: row.position,
    width: row.width,
    height: row.height,
  };
}
