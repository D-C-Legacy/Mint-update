import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateDraftInput,
  ListApplicationsFilter,
  SellerRepositoryPort,
  UpdateCommissionInput,
  UpdateDraftInput,
  UpdateProfileInput,
} from '../../domain/ports/seller.repository.port';
import { Seller } from '../../domain/entities/seller.entity';
import { SellerApplicationDetail, SellerApplicationSummary } from '../../domain/entities/seller-application-summary.entity';
import { toDomainSeller } from '../mappers/seller.mapper';
import { toApplicationDetail, toApplicationSummary } from '../mappers/seller-application-summary.mapper';

const APPLICATION_INCLUDE = { application: true } as const;

@Injectable()
export class SellerPrismaRepository implements SellerRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<Seller | null> {
    const row = await this.prisma.seller.findUnique({ where: { userId }, include: APPLICATION_INCLUDE });
    return row ? toDomainSeller(row) : null;
  }

  async findById(id: string): Promise<Seller | null> {
    const row = await this.prisma.seller.findUnique({ where: { id }, include: APPLICATION_INCLUDE });
    return row ? toDomainSeller(row) : null;
  }

  async findByApplicationId(applicationId: string): Promise<Seller | null> {
    const row = await this.prisma.seller.findFirst({
      where: { application: { id: applicationId } },
      include: APPLICATION_INCLUDE,
    });
    return row ? toDomainSeller(row) : null;
  }

  async createDraft(input: CreateDraftInput): Promise<Seller> {
    const row = await this.prisma.seller.create({
      data: {
        id: input.id,
        userId: input.userId,
        type: input.type,
        legalName: input.legalName,
        displayName: input.displayName,
        application: {
          create: {
            id: input.applicationId,
            formData: input.formData as Prisma.InputJsonValue,
          },
        },
      },
      include: APPLICATION_INCLUDE,
    });
    return toDomainSeller(row);
  }

  async updateDraft(sellerId: string, input: UpdateDraftInput): Promise<Seller> {
    const row = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        type: input.type,
        legalName: input.legalName,
        displayName: input.displayName,
        application: {
          update: { formData: input.formData as Prisma.InputJsonValue },
        },
      },
      include: APPLICATION_INCLUDE,
    });
    return toDomainSeller(row);
  }

  async submit(sellerId: string, submittedAt: Date): Promise<Seller> {
    const row = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        status: 'PENDING_REVIEW',
        application: { update: { submittedAt } },
      },
      include: APPLICATION_INCLUDE,
    });
    return toDomainSeller(row);
  }

  async withdraw(sellerId: string): Promise<Seller> {
    const row = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        status: 'DRAFT',
        application: { update: { submittedAt: null } },
      },
      include: APPLICATION_INCLUDE,
    });
    return toDomainSeller(row);
  }

  async approve(sellerId: string, reviewedByUserId: string, approvedAt: Date): Promise<Seller> {
    const row = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        status: 'APPROVED',
        approvedAt,
        approvedByUserId: reviewedByUserId,
        application: {
          update: { decision: 'APPROVED', reviewedAt: approvedAt, reviewedByUserId },
        },
      },
      include: APPLICATION_INCLUDE,
    });
    return toDomainSeller(row);
  }

  async reject(sellerId: string, reviewedByUserId: string, reviewedAt: Date, reason: string): Promise<Seller> {
    const row = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        status: 'REJECTED',
        application: {
          update: { decision: 'REJECTED', reviewedAt, reviewedByUserId, rejectionReason: reason },
        },
      },
      include: APPLICATION_INCLUDE,
    });
    return toDomainSeller(row);
  }

  async suspend(sellerId: string, suspendedAt: Date): Promise<Seller> {
    const row = await this.prisma.seller.update({
      where: { id: sellerId },
      data: { status: 'SUSPENDED', suspendedAt },
      include: APPLICATION_INCLUDE,
    });
    return toDomainSeller(row);
  }

  async reinstate(sellerId: string): Promise<Seller> {
    const row = await this.prisma.seller.update({
      where: { id: sellerId },
      data: { status: 'APPROVED', suspendedAt: null },
      include: APPLICATION_INCLUDE,
    });
    return toDomainSeller(row);
  }

  async updateProfile(sellerId: string, input: UpdateProfileInput): Promise<Seller> {
    const row = await this.prisma.seller.update({
      where: { id: sellerId },
      data: { displayName: input.displayName },
      include: APPLICATION_INCLUDE,
    });
    return toDomainSeller(row);
  }

  async updateCommission(sellerId: string, input: UpdateCommissionInput): Promise<Seller> {
    const row = await this.prisma.seller.update({
      where: { id: sellerId },
      data: { commissionBps: input.commissionBps },
      include: APPLICATION_INCLUDE,
    });
    return toDomainSeller(row);
  }

  async listApplications(filter: ListApplicationsFilter): Promise<SellerApplicationSummary[]> {
    const rows = await this.prisma.sellerApplication.findMany({
      take: filter.limit + 1,
      orderBy: { submittedAt: 'desc' },
      include: { seller: true },
      ...(filter.decision ? { where: { decision: filter.decision } } : {}),
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toApplicationSummary);
  }

  async getApplicationDetail(applicationId: string): Promise<SellerApplicationDetail | null> {
    const row = await this.prisma.sellerApplication.findUnique({
      where: { id: applicationId },
      include: { seller: true, documents: true },
    });
    return row ? toApplicationDetail(row) : null;
  }
}
