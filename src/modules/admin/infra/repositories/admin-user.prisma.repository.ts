import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { CursorPage, buildCursorPage } from '../../../../shared/pagination/cursor';
import {
  AdminUserRepositoryPort,
  ListAdminUsersFilter,
} from '../../domain/ports/admin-user.repository.port';
import { AdminUserDetail, AdminUserSummary } from '../../domain/entities/admin-user.entity';

@Injectable()
export class AdminUserPrismaRepository implements AdminUserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: ListAdminUsersFilter): Promise<CursorPage<AdminUserSummary>> {
    // The most correct user-facing search results come from the schema itself, not assumptions:
    // email/displayName/id contains-insensitive for q, direct equality for status/role. Platform has
    // no dedicated column on the User table — devices are linked by relationship (identity.prisma L16),
    // so IOS/ANDROID/WEB filter on the device link, UNKNOWN means a user with no devices.
    const where: Prisma.UserWhereInput = {
      ...(filter.q
        ? {
            OR: [
              { email: { contains: filter.q, mode: 'insensitive' } },
              { displayName: { contains: filter.q, mode: 'insensitive' } },
              { id: { contains: filter.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filter.status !== undefined ? { status: filter.status } : {}),
      ...(filter.role !== undefined ? { role: filter.role } : {}),
      ...(filter.platform && filter.platform !== 'UNKNOWN'
        ? { devices: { some: { platform: filter.platform } } }
        : {}),
      ...(filter.platform === 'UNKNOWN' ? { devices: { none: {} } } : {}),
    };

    const rows = await this.prisma.user.findMany({
      where,
      take: filter.limit + 1,
      orderBy: { createdAt: 'desc' },
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
      include: {
        devices: { orderBy: { lastSeenAt: 'desc' }, take: 1, select: { platform: true } },
        seller: { select: { id: true, status: true } },
      },
    });

    const summaries: AdminUserSummary[] = rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      primaryPlatform: row.devices[0]?.platform ?? 'UNKNOWN',
      isSeller: !!row.seller,
      sellerStatus: row.seller?.status ?? null,
      deletionScheduledAt: row.deletionScheduledAt?.toISOString() ?? null,
    }));
    return buildCursorPage(summaries, filter.limit);
  }

  async getDetail(userId: string): Promise<AdminUserDetail | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        devices: {
          orderBy: { lastSeenAt: 'desc' },
          select: { id: true, platform: true, lastSeenAt: true },
        },
        seller: { select: { id: true, status: true, displayName: true, type: true } },
        addresses: {
          select: { id: true, city: true, region: true, countryCode: true, isDefault: true },
        },
        paymentCustomer: { select: { userId: true, providerCustomerId: true } },
        teamMemberships: { select: { id: true, sellerId: true, role: true } },
        _count: { select: { addresses: true } },
      },
    });
    if (!row) return null;

    // User has no direct orders relation (Order.buyerUserId is a plain string, orders.prisma L4),
    // so the count is a standalone query instead of the _count aggregate.
    const orderCount = await this.prisma.order.count({ where: { buyerUserId: userId } });

    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      role: row.role,
      status: row.status,
      emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      devices: row.devices.map((device) => ({
        id: device.id,
        platform: device.platform,
        lastSeenAt: device.lastSeenAt.toISOString(),
      })),
      primaryPlatform: row.devices[0]?.platform ?? 'UNKNOWN',
      seller: row.seller
        ? {
            id: row.seller.id,
            status: row.seller.status,
            displayName: row.seller.displayName,
            type: row.seller.type,
          }
        : null,
      addresses: row.addresses,
      paymentCustomer: row.paymentCustomer
        ? {
            userId: row.paymentCustomer.userId,
            providerCustomerId: row.paymentCustomer.providerCustomerId,
          }
        : null,
      teamMemberships: row.teamMemberships,
      orderCount,
      addressCount: row._count.addresses,
      deletionRequestedAt: row.deletionRequestedAt?.toISOString() ?? null,
      deletionScheduledAt: row.deletionScheduledAt?.toISOString() ?? null,
    };
  }

  async updateStatus(
    userId: string,
    status: 'ACTIVE' | 'SUSPENDED',
  ): Promise<{ id: string; status: string }> {
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, status: true },
    });
    return row;
  }
}
