import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateInvitationInput,
  ListInvitationsFilter,
  SellerInvitationRepositoryPort,
} from '../../domain/ports/seller-team.repository.port';
import { SellerInvitation } from '../../domain/entities/seller-team.entity';
import { toDomainSellerInvitation } from '../mappers/seller-team.mapper';

@Injectable()
export class SellerInvitationPrismaRepository implements SellerInvitationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SellerInvitation | null> {
    const row = await this.prisma.sellerInvitation.findUnique({ where: { id } });
    return row ? toDomainSellerInvitation(row) : null;
  }

  async findByToken(token: string): Promise<SellerInvitation | null> {
    const row = await this.prisma.sellerInvitation.findUnique({ where: { token } });
    return row ? toDomainSellerInvitation(row) : null;
  }

  async findBySellerIdAndEmail(sellerId: string, email: string): Promise<SellerInvitation | null> {
    const row = await this.prisma.sellerInvitation.findFirst({
      where: { sellerId, email },
    });
    return row ? toDomainSellerInvitation(row) : null;
  }

  async create(input: CreateInvitationInput): Promise<SellerInvitation> {
    const row = await this.prisma.sellerInvitation.create({
      data: {
        id: input.id,
        sellerId: input.sellerId,
        email: input.email,
        role: input.role,
        token: input.token,
        expiresAt: input.expiresAt,
      },
    });
    return toDomainSellerInvitation(row);
  }

  async updateStatus(
    id: string,
    status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED',
    acceptedAt?: Date,
  ): Promise<SellerInvitation> {
    const row = await this.prisma.sellerInvitation.update({
      where: { id },
      data: {
        status,
        ...(acceptedAt !== undefined ? { acceptedAt } : {}),
      },
    });
    return toDomainSellerInvitation(row);
  }

  async list(filter: ListInvitationsFilter): Promise<SellerInvitation[]> {
    const rows = await this.prisma.sellerInvitation.findMany({
      where: {
        sellerId: filter.sellerId,
        ...(filter.status ? { status: filter.status } : {}),
      },
      take: filter.limit + 1,
      orderBy: { createdAt: 'desc' },
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainSellerInvitation);
  }
}
