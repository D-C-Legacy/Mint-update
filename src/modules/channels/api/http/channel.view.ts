import { Channel } from '../../domain/entities/channel.entity';

// Public shape for channel reads (GET /channels/:slug, GET /channels, GET /me/following).
// `sellerId` is included: every public product already exposes its sellerId, so it links a
// product to its channel without adding exposure. Hidden: `bannerKey` (raw storage key);
// `bannerUrl` is the CDN URL instead. The seller's own PATCH /channel response is unchanged.
export interface PublicChannelView {
  readonly id: string;
  readonly sellerId: string;
  readonly slug: string;
  readonly name: string;
  readonly bio: string | null;
  readonly bannerUrl: string | null;
  readonly followerCount: number;
  readonly isActive: boolean;
  readonly createdAt: string;
}

export function toPublicChannelView(
  channel: Channel,
  bannerUrlFor: (storageKey: string) => string,
): PublicChannelView {
  return {
    id: channel.id,
    sellerId: channel.sellerId,
    slug: channel.slug,
    name: channel.name,
    bio: channel.bio,
    bannerUrl: channel.bannerKey ? bannerUrlFor(channel.bannerKey) : null,
    followerCount: channel.followerCount,
    isActive: channel.isActive,
    createdAt: channel.createdAt.toISOString(),
  };
}
