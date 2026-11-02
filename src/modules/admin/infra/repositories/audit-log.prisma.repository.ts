import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  AuditLogRepositoryPort,
  CreateAuditLogInput,
  ListAuditLogFilter,
} from '../../domain/ports/audit-log.repository.port';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import { toDomainAuditLog } from '../mappers/audit-log.mapper';

@Injectable()
export class AuditLogPrismaRepository implements AuditLogRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    const row = await this.prisma.auditLog.create({
      data: {
        id: input.id,
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        ...(input.before !== undefined ? { before: input.before as Prisma.InputJsonValue } : {}),
        ...(input.after !== undefined ? { after: input.after as Prisma.InputJsonValue } : {}),
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
        ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
      },
    });
    return toDomainAuditLog(row);
  }

  async list(filter: ListAuditLogFilter): Promise<AuditLog[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(filter.actorUserId !== undefined ? { actorUserId: filter.actorUserId } : {}),
        ...(filter.targetType !== undefined ? { targetType: filter.targetType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainAuditLog);
  }
}
