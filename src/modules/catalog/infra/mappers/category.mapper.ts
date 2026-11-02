import type { Category as PrismaCategory } from '@prisma/client';
import { Category } from '../../domain/entities/category.entity';

export function toDomainCategory(row: PrismaCategory): Category {
  return {
    id: row.id,
    parentId: row.parentId,
    slug: row.slug,
    name: row.name,
    position: row.position,
    isActive: row.isActive,
  };
}
