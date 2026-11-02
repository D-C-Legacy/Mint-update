import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { CreateRefundInput, RefundRepositoryPort } from '../../domain/ports/refund.repository.port';
import { Refund, RefundStatus } from '../../domain/entities/refund.entity';
import { toDomainRefund } from '../mappers/refund.mapper';

@Injectable()
export class RefundPrismaRepository implements RefundRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateRefundInput): Promise<Refund> {
    const row = await this.prisma.refund.create({
      data: {
        id: input.id,
        paymentId: input.paymentId,
        providerRefundId: input.providerRefundId,
        amount: input.amount,
        reason: input.reason,
        status: input.status,
        initiatedByUserId: input.initiatedByUserId,
      },
    });
    return toDomainRefund(row);
  }

  async findByProviderRefundId(providerRefundId: string): Promise<Refund | null> {
    const row = await this.prisma.refund.findUnique({ where: { providerRefundId } });
    return row ? toDomainRefund(row) : null;
  }

  async updateStatus(id: string, status: RefundStatus): Promise<Refund> {
    const row = await this.prisma.refund.update({ where: { id }, data: { status } });
    return toDomainRefund(row);
  }

  async sumSucceededByPaymentId(paymentId: string): Promise<bigint> {
    const rows = await this.prisma.refund.findMany({
      where: { paymentId, status: 'SUCCEEDED' },
      select: { amount: true },
    });
    return rows.reduce((total, row) => total + row.amount, 0n);
  }
}
