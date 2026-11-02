import { HelpArticle } from '../entities/help-article.entity';

export const HELP_REPOSITORY = Symbol('HelpRepositoryPort');

export interface CreateHelpArticleInput {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly body: string;
  readonly sortOrder: number;
}

export interface UpdateHelpArticleInput {
  readonly category?: string;
  readonly title?: string;
  readonly body?: string;
  readonly sortOrder?: number;
  readonly isPublished?: boolean;
}

export interface HelpRepositoryPort {
  create(input: CreateHelpArticleInput): Promise<HelpArticle>;
  findById(id: string): Promise<HelpArticle | null>;
  update(id: string, input: UpdateHelpArticleInput): Promise<HelpArticle | null>;
  delete(id: string): Promise<boolean>;
  /** Public — published only, grouped by category via sortOrder. */
  listPublished(category: string | undefined): Promise<HelpArticle[]>;
  /** Admin — every article, published or not. */
  listAll(): Promise<HelpArticle[]>;
}
