import { HelpArticle } from '../../domain/entities/help-article.entity';

export function toHelpArticleView(article: HelpArticle): Record<string, unknown> {
  return {
    id: article.id,
    category: article.category,
    title: article.title,
    body: article.body,
    sortOrder: article.sortOrder,
    isPublished: article.isPublished,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };
}
