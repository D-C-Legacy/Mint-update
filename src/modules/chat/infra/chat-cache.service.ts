import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../platform/redis/redis.service';
import { ChatMessage } from '../domain/entities/chat-message.entity';

const MAX_RECENT_MESSAGES = 50;

export interface ChatMessageSnapshot {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly body: string;
  readonly type: string;
  // Resolved display name, captured at send time so a joiner's room.state snapshot and the live
  // chat.message event both carry a real name instead of a raw user id. Older cached entries
  // (written before this field existed) simply omit it; readers fall back to userId.
  readonly displayName: string;
  readonly createdAt: string;
}

function recentKey(sessionId: string): string {
  return `room:${sessionId}:chat:recent`;
}

function toSnapshot(message: ChatMessage, displayName: string): ChatMessageSnapshot {
  return {
    id: message.id,
    sessionId: message.sessionId,
    userId: message.userId,
    body: message.body,
    type: message.type,
    displayName,
    createdAt: message.createdAt.toISOString(),
  };
}

// 06-REALTIME-AND-CONCURRENCY.md §9: "Keep the last 50 messages in a Redis capped list per room
// for instant room.state snapshots." A capped RPUSH+LTRIM list, not the source of truth (Postgres
// is, via the async persist job) — losing this cache is acceptable (§9: "Chat is the one place
// where losing a message is acceptable"), it just means a freshly-joining client's snapshot is
// momentarily thinner, never wrong.
@Injectable()
export class ChatCacheService {
  constructor(private readonly redis: RedisService) {}

  async pushRecentMessage(message: ChatMessage, displayName: string): Promise<void> {
    const key = recentKey(message.sessionId);
    await this.redis.client.rpush(key, JSON.stringify(toSnapshot(message, displayName)));
    await this.redis.client.ltrim(key, -MAX_RECENT_MESSAGES, -1);
  }

  async getRecentMessages(sessionId: string): Promise<ChatMessageSnapshot[]> {
    const raw = await this.redis.client.lrange(recentKey(sessionId), 0, -1);
    return raw.map((entry) => {
      const parsed = JSON.parse(entry) as Partial<ChatMessageSnapshot>;
      return {
        id: parsed.id ?? '',
        sessionId: parsed.sessionId ?? sessionId,
        userId: parsed.userId ?? '',
        body: parsed.body ?? '',
        type: parsed.type ?? 'USER',
        displayName: parsed.displayName ?? parsed.userId ?? '',
        createdAt: parsed.createdAt ?? '',
      };
    });
  }

  // Moderation delete removes the message from the capped list too, so a client joining after
  // the fact doesn't see it in its room.state snapshot. The list is small (capped at 50) so a
  // read-filter-rewrite is cheap; there's no indexed "delete by id" on a plain Redis list.
  async removeMessage(sessionId: string, messageId: string): Promise<void> {
    const key = recentKey(sessionId);
    const raw = await this.redis.client.lrange(key, 0, -1);
    const filtered = raw.filter(
      (entry) => (JSON.parse(entry) as ChatMessageSnapshot).id !== messageId,
    );
    if (filtered.length === raw.length) {
      return;
    }

    const multi = this.redis.client.multi();
    multi.del(key);
    if (filtered.length > 0) {
      multi.rpush(key, ...filtered);
    }
    await multi.exec();
  }
}
