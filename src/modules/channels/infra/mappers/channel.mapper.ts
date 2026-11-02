import type { Channel as PrismaChannel } from '@prisma/client';
import { Channel } from '../../domain/entities/channel.entity';

export function toDomainChannel(row: PrismaChannel): Channel {
  return {
    id: row.id,
    sellerId: row.sellerId,
    slug: row.slug,
    name: row.name,
    bio: row.bio,
    bannerKey: row.bannerKey,
    followerCount: row.followerCount,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}
