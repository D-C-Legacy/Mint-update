import { Injectable } from '@nestjs/common';
import type { Sale as PrismaSale } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type { TransactionClient } from '../../../../platform/database/transaction.manager';
import {
  ApplyBidInput,
  CreateSaleInput,
  ListPublicSalesFilter,
  ListSessionPurchasesFilter,
  ResolveToResolvedInput,
  SaleRepositoryPort,
  SessionSalesStats,
  SwitchModeInput,
} from '../../domain/ports/sale.repository.port';
import { Sale } from '../../domain/entities/sale.entity';
import { toDomainSale } from '../mappers/sale.mapper';

@Injectable()
export class SalePrismaRepository implements SaleRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Sale | null> {
    const row = await this.prisma.sale.findUnique({ where: { id } });
    return row ? toDomainSale(row) : null;
  }

  async listPublic(filter: ListPublicSalesFilter): Promise<Sale[]> {
    const rows = await this.prisma.sale.findMany({
      where: {
        status: filter.status,
        ...(filter.mode ? { mode: filter.mode } : {}),
        ...(filter.productId ? { productId: filter.productId } : {}),
      },
      take: filter.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainSale);
  }

  async create(input: CreateSaleInput): Promise<Sale> {
    const row = await this.prisma.sale.create({
      data: {
        id: input.id,
        sessionId: input.sessionId,
        sellerId: input.sellerId,
        productId: input.productId,
        mode: input.mode,
        currency: input.currency,
        quantity: input.quantity,
        ...(input.startAmount !== null ? { startAmount: input.startAmount } : {}),
        ...(input.endsAt !== null ? { endsAt: input.endsAt } : {}),
        ...(input.price !== null ? { price: input.price } : {}),
      },
    });
    return toDomainSale(row);
  }

  // Row-locked per 06-REALTIME-AND-CONCURRENCY.md §4 (ADR-003: not Redis Lua). Raw SQL is
  // required — Prisma's query builder has no FOR UPDATE support. Must run inside the same
  // trx as the subsequent bid insert + sale update for the lock to serialize them.
  async lockForUpdate(trx: TransactionClient, id: string): Promise<Sale | null> {
    const rows = await trx.$queryRaw<PrismaSale[]>`
      SELECT * FROM "Sale" WHERE id = ${id} FOR UPDATE;
    `;
    return rows[0] ? toDomainSale(rows[0]) : null;
  }

  async applyBid(trx: TransactionClient, id: string, input: ApplyBidInput): Promise<Sale> {
    const row = await trx.sale.update({
      where: { id },
      data: {
        currentAmount: input.currentAmount,
        currentBidId: input.currentBidId,
        endsAt: input.endsAt,
        version: { increment: 1 },
        ...(input.extended ? { extensionCount: { increment: 1 } } : {}),
      },
    });
    return toDomainSale(row);
  }

  async switchMode(trx: TransactionClient, id: string, input: SwitchModeInput): Promise<Sale> {
    const row = await trx.sale.update({
      where: { id },
      data: {
        mode: input.mode,
        version: { increment: 1 },
        ...(input.mode === 'BUY_NOW' ? { price: input.price, quantity: input.quantity } : {}),
        ...(input.mode === 'AUCTION'
          ? { startAmount: input.startAmount, endsAt: input.endsAt }
          : {}),
      },
    });
    return toDomainSale(row);
  }

  async resolveToExpired(trx: TransactionClient, id: string, resolvedAt: Date): Promise<Sale> {
    const row = await trx.sale.update({
      where: { id },
      data: { status: 'EXPIRED', resolvedAt },
    });
    return toDomainSale(row);
  }

  async resolveToResolved(
    trx: TransactionClient,
    id: string,
    input: ResolveToResolvedInput,
  ): Promise<Sale> {
    const row = await trx.sale.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        winnerUserId: input.winnerUserId,
        finalAmount: input.finalAmount,
        resolvedAt: input.resolvedAt,
      },
    });
    return toDomainSale(row);
  }

  async findExpiredOpen(limit: number): Promise<Sale[]> {
    const rows = await this.prisma.sale.findMany({
      where: { status: 'OPEN', endsAt: { lt: new Date() } },
      take: limit,
    });
    return rows.map(toDomainSale);
  }

  async resolveOpenToResolved(
    id: string,
    input: ResolveToResolvedInput,
    trx?: TransactionClient,
  ): Promise<Sale | null> {
    const db = trx ?? this.prisma;
    const { count } = await db.sale.updateMany({
      where: { id, status: 'OPEN' },
      data: {
        status: 'RESOLVED',
        winnerUserId: input.winnerUserId,
        finalAmount: input.finalAmount,
        resolvedAt: input.resolvedAt,
      },
    });
    if (count === 0) {
      return null;
    }
    const row = await db.sale.findUnique({ where: { id } });
    return row ? toDomainSale(row) : null;
  }

  async cancelOpen(id: string, cancelledAt: Date): Promise<Sale | null> {
    const { count } = await this.prisma.sale.updateMany({
      where: { id, status: 'OPEN' },
      data: { status: 'CANCELLED', resolvedAt: cancelledAt },
    });
    if (count === 0) {
      return null;
    }
    return this.findById(id);
  }

  async listBySessionId(filter: ListSessionPurchasesFilter): Promise<Sale[]> {
    const rows = await this.prisma.sale.findMany({
      where: {
        sessionId: filter.sessionId,
        status: 'RESOLVED',
      },
      take: filter.limit + 1,
      orderBy: [{ resolvedAt: 'desc' }, { id: 'desc' }],
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainSale);
  }

  async getSessionSalesStats(sessionId: string): Promise<SessionSalesStats> {
    const result = await this.prisma.sale.aggregate({
      where: { sessionId, orderId: { not: null } },
      _count: { _all: true },
      _sum: { finalAmount: true },
    });
    return { itemsSold: result._count._all, grossAmount: result._sum.finalAmount ?? 0n };
  }
}
