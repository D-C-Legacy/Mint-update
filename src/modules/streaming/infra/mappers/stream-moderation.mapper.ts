import type {
  StreamModerator as PrismaStreamModerator,
  ChatTimeout as PrismaChatTimeout,
} from '@prisma/client';
import { StreamModerator, ChatTimeout } from '../../domain/entities/stream-moderation.entity';

export function toDomainStreamModerator(row: PrismaStreamModerator): StreamModerator {
  return {
    id: row.id,
    sessionId: row.sessionId,
    userId: row.userId,
    addedBy: row.addedBy,
    role: row.role,
    createdAt: row.createdAt,
  };
}

export function toDomainChatTimeout(row: PrismaChatTimeout): ChatTimeout {
  return {
    id: row.id,
    sessionId: row.sessionId,
    userId: row.userId,
    moderatorId: row.moderatorId,
    expiresAt: row.expiresAt,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}
