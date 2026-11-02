import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateOfferInput,
  ListSellerOffersFilter,
  OfferRepositoryPort,
  RespondInput,
} from '../../domain/ports/offer.repository.port';
import { Offer } from '../../domain/entities/offer.entity';
import { toDomainOffer } from '../mappers/offer.mapper';

@Injectable()
export class OfferPrismaRepository implements OfferRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Offer | null> {
    const row = await this.prisma.offer.findUnique({ where: { id } });
    return row ? toDomainOffer(row) : null;
  }

  // Offers on the seller's own sales — join through Sale (Sale.sellerId), which already carries a
  // (sellerId, resolvedAt) index; no schema change was needed for this filter.
  async listBySellerId(filter: ListSellerOffersFilter): Promise<Offer[]> {
    const rows = await this.prisma.offer.findMany({
      where: {
        sale: { sellerId: filter.sellerId },
        ...(filter.statuses?.length ? { status: { in: filter.statuses } } : {}),
      },
      take: filter.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainOffer);
  }

  async create(input: CreateOfferInput): Promise<Offer> {
    const row = await this.prisma.offer.create({
      data: {
        id: input.id,
        saleId: input.saleId,
        userId: input.userId,
        amount: input.amount,
        expiresAt: input.expiresAt,
      },
    });
    return toDomainOffer(row);
  }

  async respond(id: string, input: RespondInput): Promise<Offer | null> {
    const { count } = await this.prisma.offer.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: input.status,
        respondedAt: input.respondedAt,
        ...(input.counterAmount !== null ? { counterAmount: input.counterAmount } : {}),
      },
    });
    if (count === 0) {
      return null;
    }
    return this.findById(id);
  }

  async expirePending(): Promise<number> {
    const { count } = await this.prisma.offer.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
    return count;
  }
}
