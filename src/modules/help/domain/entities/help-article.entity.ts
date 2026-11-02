export interface HelpArticle {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly body: string;
  readonly sortOrder: number;
  readonly isPublished: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
