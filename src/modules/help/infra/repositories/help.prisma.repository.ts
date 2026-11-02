import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { CreateHelpArticleInput, HelpRepositoryPort, UpdateHelpArticleInput } from '../../domain/ports/help.repository.port';
import { HelpArticle } from '../../domain/entities/help-article.entity';
import { toDomainHelpArticle } from '../mappers/help-article.mapper';

@Injectable()
export class HelpPrismaRepository implements HelpRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateHelpArticleInput): Promise<HelpArticle> {
    const row = await this.prisma.helpArticle.create({
      data: { id: input.id, category: input.category, title: input.title, body: input.body, sortOrder: input.sortOrder },
    });
    return toDomainHelpArticle(row);
  }

  async findById(id: string): Promise<HelpArticle | null> {
    const row = await this.prisma.helpArticle.findUnique({ where: { id } });
    return row ? toDomainHelpArticle(row) : null;
  }

  async update(id: string, input: UpdateHelpArticleInput): Promise<HelpArticle | null> {
    const existing = await this.prisma.helpArticle.findUnique({ where: { id } });
    if (!existing) return null;
    const row = await this.prisma.helpArticle.update({ where: { id }, data: { ...input } });
    return toDomainHelpArticle(row);
  }

  async delete(id: string): Promise<boolean> {
    const { count } = await this.prisma.helpArticle.deleteMany({ where: { id } });
    return count > 0;
  }

  async listPublished(category: string | undefined): Promise<HelpArticle[]> {
    const rows = await this.prisma.helpArticle.findMany({
      where: { isPublished: true, ...(category ? { category } : {}) },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
    return rows.map(toDomainHelpArticle);
  }

  async listAll(): Promise<HelpArticle[]> {
    const rows = await this.prisma.helpArticle.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
    return rows.map(toDomainHelpArticle);
  }
}
