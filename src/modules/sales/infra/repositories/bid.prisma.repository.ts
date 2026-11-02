import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type { TransactionClient } from '../../../../platform/database/transaction.manager';
import {
  BidRepositoryPort,
  CreateBidInput,
  ListBidsFilter,
  ListMyBidsFilter,
} from '../../domain/ports/bid.repository.port';
import { Bid } from '../../domain/entities/bid.entity';
import { toDomainBid } from '../mappers/bid.mapper';

@Injectable()
export class BidPrismaRepository implements BidRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Bid | null> {
    const row = await this.prisma.bid.findUnique({ where: { id } });
    return row ? toDomainBid(row) : null;
  }

  // sequence is assigned inside the same transaction as the Sale row lock (see
  // SaleRepositoryPort.lockForUpdate) — that lock is what makes MAX(sequence)+1 safe here
  // without a separate locking mechanism of its own.
  async create(trx: TransactionClient, input: CreateBidInput): Promise<Bid> {
    const last = await trx.bid.aggregate({
      where: { saleId: input.saleId },
      _max: { sequence: true },
    });
    const sequence = (last._max.sequence ?? 0) + 1;

    const row = await trx.bid.create({
      data: { id: input.id, saleId: input.saleId, userId: input.userId, amount: input.amount, sequence },
    });
    return toDomainBid(row);
  }

  async findByUserId(filter: ListMyBidsFilter): Promise<Bid[]> {
    const rows = await this.prisma.bid.findMany({
      where: { userId: filter.userId },
      take: filter.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainBid);
  }

  async findBySaleId(filter: ListBidsFilter): Promise<Bid[]> {
    const rows = await this.prisma.bid.findMany({
      where: { saleId: filter.saleId },
      take: filter.limit + 1,
      orderBy: { createdAt: 'desc' },
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainBid);
  }
}
