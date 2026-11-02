import { HelpArticle as PrismaHelpArticle } from '@prisma/client';
import { HelpArticle } from '../../domain/entities/help-article.entity';

export function toDomainHelpArticle(row: PrismaHelpArticle): HelpArticle {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
