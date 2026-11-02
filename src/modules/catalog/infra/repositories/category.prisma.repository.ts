import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';
import { Category } from '../../domain/entities/category.entity';
import { toDomainCategory } from '../mappers/category.mapper';

@Injectable()
export class CategoryPrismaRepository implements CategoryRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({ where: { id } });
    return row ? toDomainCategory(row) : null;
  }

  async listActive(): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ parentId: 'asc' }, { position: 'asc' }],
    });
    return rows.map(toDomainCategory);
  }
}
