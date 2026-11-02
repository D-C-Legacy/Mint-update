import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CompleteRunInput,
  CreatePayoutInput,
  CreatePayoutRunInput,
  ListBySellerFilter,
  ListByStatusFilter,
  ListRunsFilter,
  PayoutRepositoryPort,
  UpdatePayoutOutcomeInput,
} from '../../domain/ports/payout.repository.port';
import { PayoutRun } from '../../domain/entities/payout-run.entity';
import { Payout } from '../../domain/entities/payout.entity';
import { toDomainPayoutRun } from '../mappers/payout-run.mapper';
import { toDomainPayout } from '../mappers/payout.mapper';

@Injectable()
export class PayoutPrismaRepository implements PayoutRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findLatestCompletedRun(): Promise<PayoutRun | null> {
    const row = await this.prisma.payoutRun.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { periodEnd: 'desc' },
    });
    return row ? toDomainPayoutRun(row) : null;
  }

  async createRun(input: CreatePayoutRunInput): Promise<PayoutRun> {
    const row = await this.prisma.payoutRun.create({
      data: {
        id: input.id,
        status: 'RUNNING',
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        startedAt: input.startedAt,
      },
    });
    return toDomainPayoutRun(row);
  }

  async completeRun(id: string, input: CompleteRunInput): Promise<PayoutRun> {
    const row = await this.prisma.payoutRun.update({
      where: { id },
      data: {
        status: input.status,
        totalAmount: input.totalAmount,
        payoutCount: input.payoutCount,
        completedAt: input.completedAt,
      },
    });
    return toDomainPayoutRun(row);
  }

  async findPayoutById(id: string): Promise<Payout | null> {
    const row = await this.prisma.payout.findUnique({ where: { id }, include: { items: true } });
    return row ? toDomainPayout(row) : null;
  }

  async findAlreadyPaidOrderIds(orderIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (orderIds.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.payoutItem.findMany({
      where: { orderId: { in: [...orderIds] } },
      select: { orderId: true },
    });
    return new Set(rows.map((row) => row.orderId));
  }

  // One Prisma nested-write call — `items: { create: [...] }` is atomic in a single round trip,
  // same "prefer nested writes" precedent as P7-03's LedgerRepositoryPort.createTransaction.
  // Unlike that precedent, a P2002 here returns null, not a fetched existing row — see the
  // port's own doc comment for why there's no single "winner" to hand back.
  async createPayout(input: CreatePayoutInput): Promise<Payout | null> {
    try {
      const row = await this.prisma.payout.create({
        data: {
          id: input.id,
          runId: input.runId,
          sellerId: input.sellerId,
          amount: input.amount,
          currency: input.currency,
          idempotencyKey: input.idempotencyKey,
          items: {
            create: input.items.map((item) => ({ id: item.id, orderId: item.orderId, amount: item.amount })),
          },
        },
        include: { items: true },
      });
      return toDomainPayout(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return null;
      }
      throw err;
    }
  }

  async findByStatus(filter: ListByStatusFilter): Promise<Payout[]> {
    const rows = await this.prisma.payout.findMany({
      where: { status: filter.status },
      orderBy: { createdAt: 'desc' },
      take: filter.limit + 1,
      include: { items: true },
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainPayout);
  }

  async findBySeller(filter: ListBySellerFilter): Promise<Payout[]> {
    const rows = await this.prisma.payout.findMany({
      where: { sellerId: filter.sellerId, ...(filter.status !== undefined ? { status: filter.status } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
      include: { items: true },
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainPayout);
  }

  async listRuns(filter: ListRunsFilter): Promise<PayoutRun[]> {
    const rows = await this.prisma.payoutRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainPayoutRun);
  }

  async holdPayout(id: string): Promise<Payout | null> {
    const { count } = await this.prisma.payout.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'HELD' },
    });
    if (count === 0) {
      return null;
    }
    return this.findPayoutById(id);
  }

  async updatePayoutOutcome(id: string, input: UpdatePayoutOutcomeInput): Promise<Payout> {
    const row = await this.prisma.payout.update({
      where: { id },
      data: {
        status: input.status,
        providerTransferId: input.providerTransferId,
        failureReason: input.failureReason,
        sentAt: input.sentAt,
      },
      include: { items: true },
    });
    return toDomainPayout(row);
  }
}
