import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateTeamMemberInput,
  ListTeamMembersFilter,
  SellerTeamRepositoryPort,
  UpdateTeamMemberInput,
} from '../../domain/ports/seller-team.repository.port';
import { SellerTeamMember } from '../../domain/entities/seller-team.entity';
import { toDomainSellerTeamMember } from '../mappers/seller-team.mapper';

@Injectable()
export class SellerTeamPrismaRepository implements SellerTeamRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SellerTeamMember | null> {
    const row = await this.prisma.sellerTeamMember.findUnique({ where: { id } });
    return row ? toDomainSellerTeamMember(row) : null;
  }

  async findBySellerIdAndUserId(
    sellerId: string,
    userId: string,
  ): Promise<SellerTeamMember | null> {
    const row = await this.prisma.sellerTeamMember.findUnique({
      where: { sellerId_userId: { sellerId, userId } },
    });
    return row ? toDomainSellerTeamMember(row) : null;
  }

  async findByUserId(userId: string): Promise<SellerTeamMember[]> {
    const rows = await this.prisma.sellerTeamMember.findMany({
      where: { userId },
    });
    return rows.map(toDomainSellerTeamMember);
  }

  async create(input: CreateTeamMemberInput): Promise<SellerTeamMember> {
    const row = await this.prisma.sellerTeamMember.create({
      data: {
        id: input.id,
        sellerId: input.sellerId,
        userId: input.userId,
        role: input.role,
      },
    });
    return toDomainSellerTeamMember(row);
  }

  async update(memberId: string, input: UpdateTeamMemberInput): Promise<SellerTeamMember> {
    const row = await this.prisma.sellerTeamMember.update({
      where: { id: memberId },
      data: { role: input.role },
    });
    return toDomainSellerTeamMember(row);
  }

  async delete(memberId: string): Promise<void> {
    await this.prisma.sellerTeamMember.delete({ where: { id: memberId } });
  }

  async list(filter: ListTeamMembersFilter): Promise<SellerTeamMember[]> {
    const rows = await this.prisma.sellerTeamMember.findMany({
      where: { sellerId: filter.sellerId },
      take: filter.limit + 1,
      orderBy: { createdAt: 'desc' },
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainSellerTeamMember);
  }
}
