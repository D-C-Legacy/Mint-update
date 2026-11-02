import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { CreateReportInput, ListForAdminFilter, ReportRepositoryPort } from '../../domain/ports/report.repository.port';
import { Report } from '../../domain/entities/report.entity';
import { toDomainReport } from '../mappers/report.mapper';

@Injectable()
export class ReportPrismaRepository implements ReportRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateReportInput): Promise<Report> {
    const row = await this.prisma.report.create({
      data: {
        id: input.id,
        targetType: input.targetType,
        targetId: input.targetId,
        reporterUserId: input.reporterUserId,
        reason: input.reason,
      },
    });
    return toDomainReport(row);
  }

  async findById(id: string): Promise<Report | null> {
    const row = await this.prisma.report.findUnique({ where: { id } });
    return row ? toDomainReport(row) : null;
  }

  async resolve(
    id: string,
    resolvedByUserId: string,
    status: 'RESOLVED' | 'DISMISSED',
    note: string | null,
  ): Promise<Report | null> {
    const { count } = await this.prisma.report.updateMany({
      where: { id, status: 'OPEN' },
      data: { status, resolvedByUserId, resolvedAt: new Date(), resolutionNote: note },
    });
    if (count === 0) return null;
    return this.findById(id);
  }

  async listForAdmin(filter: ListForAdminFilter): Promise<Report[]> {
    const rows = await this.prisma.report.findMany({
      where: { ...(filter.status ? { status: filter.status } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainReport);
  }
}
