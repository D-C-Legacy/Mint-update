import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../platform/redis/redis.service';

function banKey(channelId: string, userId: string): string {
  return `chat:ban:${channelId}:${userId}`;
}

// 06-REALTIME-AND-CONCURRENCY.md §9: "Banned and muted users are checked against a Redis set,
// refreshed on ban changes." Implemented as individual keys with a TTL matching the ban's
// expiresAt (rather than one Redis SET per channel) specifically so a time-limited ban expires
// itself automatically — a plain Redis SET has no per-member TTL, which a time-limited ban needs.
// Postgres (ChatBan) stays the source of truth for admin tooling/audit; this is purely the fast
// check path chat.send reads on every message.
@Injectable()
export class ChatBanCacheService {
  constructor(private readonly redis: RedisService) {}

  async isBanned(channelId: string, userId: string): Promise<boolean> {
    const exists = await this.redis.client.exists(banKey(channelId, userId));
    return exists === 1;
  }

  async setBan(channelId: string, userId: string, expiresAt: Date | null): Promise<void> {
    const key = banKey(channelId, userId);
    if (expiresAt) {
      const ttlMs = expiresAt.getTime() - Date.now();
      if (ttlMs > 0) {
        await this.redis.client.set(key, '1', 'PX', ttlMs);
      }
      return;
    }
    await this.redis.client.set(key, '1');
  }

  async clearBan(channelId: string, userId: string): Promise<void> {
    await this.redis.client.del(banKey(channelId, userId));
  }
}
