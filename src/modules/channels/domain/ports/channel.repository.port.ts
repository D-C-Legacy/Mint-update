import { Channel } from '../entities/channel.entity';

export const CHANNEL_REPOSITORY = Symbol('ChannelRepositoryPort');

export interface CreateChannelInput {
  readonly id: string;
  readonly sellerId: string;
  readonly name: string;
  readonly baseSlug: string;
}

export interface UpdateChannelInput {
  readonly name?: string;
  readonly bio?: string;
  readonly bannerKey?: string;
}

export interface ListFollowingFilter {
  readonly userId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface ListPublicChannelsFilter {
  /** Optional: the one channel owned by this seller (a product's seller page). */
  readonly sellerId: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface ChannelRepositoryPort {
  findById(id: string): Promise<Channel | null>;
  /** Active channels, most followed first (GET /v1/channels). Cursor paged. */
  listPublic(filter: ListPublicChannelsFilter): Promise<Channel[]>;
  findBySlug(slug: string): Promise<Channel | null>;
  findBySellerId(sellerId: string): Promise<Channel | null>;
  /** Idempotent: if a channel already exists for `input.sellerId`, returns it unchanged.
   *  Otherwise creates one, retrying with a disambiguated slug on a slug collision. */
  createIfMissing(input: CreateChannelInput): Promise<Channel>;
  update(id: string, input: UpdateChannelInput): Promise<Channel>;
  /** Idempotent: following twice does not double-increment followerCount. */
  follow(channelId: string, userId: string): Promise<Channel>;
  /** Returns null if the user wasn't following (no-op, followerCount untouched). */
  unfollow(channelId: string, userId: string): Promise<Channel | null>;
  listFollowing(filter: ListFollowingFilter): Promise<Channel[]>;
  /** Added for P8-04: "channel went live" fans out to every follower, the reverse direction of
   *  `listFollowing` (which lists the channels a given user follows). No cap/pagination — same
   *  simplicity precedent as every other notification fan-out in this ticket. */
  findFollowerUserIds(channelId: string): Promise<string[]>;
}
