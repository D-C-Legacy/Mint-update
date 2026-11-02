import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { TransactionManager } from '../../../../platform/database/transaction.manager';
import { generateId } from '../../../../shared/ids/id';
import {
  ChannelRepositoryPort,
  CreateChannelInput,
  ListFollowingFilter,
  ListPublicChannelsFilter,
  UpdateChannelInput,
} from '../../domain/ports/channel.repository.port';
import { Channel } from '../../domain/entities/channel.entity';
import { toDomainChannel } from '../mappers/channel.mapper';

const MAX_SLUG_ATTEMPTS = 5;

@Injectable()
export class ChannelPrismaRepository implements ChannelRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionManager: TransactionManager,
  ) {}

  async findById(id: string): Promise<Channel | null> {
    const row = await this.prisma.channel.findUnique({ where: { id } });
    return row ? toDomainChannel(row) : null;
  }

  async listPublic(filter: ListPublicChannelsFilter): Promise<Channel[]> {
    const rows = await this.prisma.channel.findMany({
      where: {
        isActive: true,
        ...(filter.sellerId ? { sellerId: filter.sellerId } : {}),
      },
      take: filter.limit + 1,
      orderBy: [{ followerCount: 'desc' }, { id: 'desc' }],
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainChannel);
  }

  async findBySlug(slug: string): Promise<Channel | null> {
    const row = await this.prisma.channel.findUnique({ where: { slug } });
    return row ? toDomainChannel(row) : null;
  }

  async findBySellerId(sellerId: string): Promise<Channel | null> {
    const row = await this.prisma.channel.findUnique({ where: { sellerId } });
    return row ? toDomainChannel(row) : null;
  }

  async createIfMissing(input: CreateChannelInput): Promise<Channel> {
    const existing = await this.findBySellerId(input.sellerId);
    if (existing) {
      return existing;
    }

    let slug = input.baseSlug;
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      try {
        const row = await this.prisma.channel.create({
          data: { id: input.id, sellerId: input.sellerId, slug, name: input.name },
        });
        return toDomainChannel(row);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const target = err.meta?.target as string[] | string | undefined;
          const fields = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
          if (fields.some((f) => f.includes('sellerId'))) {
            // A concurrent call (e.g. a redelivered event) won the race for this seller first —
            // that's the same idempotent outcome we want, so return what it created.
            const raced = await this.findBySellerId(input.sellerId);
            if (raced) {
              return raced;
            }
          }
          slug = `${input.baseSlug}-${generateId().slice(-5).toLowerCase()}`;
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      `Could not generate a unique slug for seller ${input.sellerId} after ${MAX_SLUG_ATTEMPTS} attempts`,
    );
  }

  async update(id: string, input: UpdateChannelInput): Promise<Channel> {
    const row = await this.prisma.channel.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.bannerKey !== undefined ? { bannerKey: input.bannerKey } : {}),
      },
    });
    return toDomainChannel(row);
  }

  async follow(channelId: string, userId: string): Promise<Channel> {
    return this.transactionManager.run(async (trx) => {
      const existing = await trx.channelFollow.findUnique({
        where: { channelId_userId: { channelId, userId } },
      });
      if (existing) {
        const channel = await trx.channel.findUniqueOrThrow({ where: { id: channelId } });
        return toDomainChannel(channel);
      }

      await trx.channelFollow.create({ data: { channelId, userId } });
      const channel = await trx.channel.update({
        where: { id: channelId },
        data: { followerCount: { increment: 1 } },
      });
      return toDomainChannel(channel);
    });
  }

  async unfollow(channelId: string, userId: string): Promise<Channel | null> {
    return this.transactionManager.run(async (trx) => {
      const deleted = await trx.channelFollow.deleteMany({ where: { channelId, userId } });
      if (deleted.count === 0) {
        return null;
      }

      const channel = await trx.channel.update({
        where: { id: channelId },
        data: { followerCount: { decrement: 1 } },
      });
      return toDomainChannel(channel);
    });
  }

  async listFollowing(filter: ListFollowingFilter): Promise<Channel[]> {
    const follows = await this.prisma.channelFollow.findMany({
      where: { userId: filter.userId },
      take: filter.limit + 1,
      orderBy: { createdAt: 'desc' },
      include: { channel: true },
      ...(filter.cursor
        ? { cursor: { channelId_userId: { channelId: filter.cursor, userId: filter.userId } }, skip: 1 }
        : {}),
    });
    return follows.map((f) => toDomainChannel(f.channel));
  }

  async findFollowerUserIds(channelId: string): Promise<string[]> {
    const follows = await this.prisma.channelFollow.findMany({
      where: { channelId },
      select: { userId: true },
    });
    return follows.map((f) => f.userId);
  }
}
