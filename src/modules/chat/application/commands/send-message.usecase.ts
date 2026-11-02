import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { generateId } from '../../../../shared/ids/id';
import { ErrorCodes } from '../../../../shared/errors/error-codes';
import { QueueNames } from '../../../../platform/queue/queue.names';
import { QueueService } from '../../../../platform/queue/queue.service';
import { RateLimitService } from '../../../../platform/rate-limit/rate-limit.service';
import { StreamingService } from '../../../streaming/application/streaming.service';
import { IdentityService } from '../../../identity/application/identity.service';
import { ChatCacheService } from '../../infra/chat-cache.service';
import { ChatBanCacheService } from '../../infra/chat-ban-cache.service';
import { PERSIST_JOB_NAME } from '../../infra/jobs/persist-chat-message.processor';
import { UpsertChatMessageInput } from '../../domain/ports/chat-message.repository.port';
import {
  ChatRateLimitedError,
  StreamNotLiveError,
  StreamSessionNotFoundError,
  UserBannedError,
} from '../../domain/errors/chat.errors';
import { ChatMessage } from '../../domain/entities/chat-message.entity';

export interface SendMessageCommand {
  readonly userId: string;
  readonly sessionId: string;
  readonly body: string;
  readonly clientRef: string;
}

export interface SendMessageResult {
  readonly message: ChatMessage;
  // Resolved here (not stored on the message) so the broadcast and the room.state snapshot both
  // carry a real display name instead of a raw user id — same enrichment the sales gateway does
  // for leaderName/winnerName, done at emit time rather than persisted on ChatMessage.
  readonly displayName: string;
  readonly clientRef: string;
}

@Injectable()
export class SendMessageUseCase {
  constructor(
    // ChatModule and StreamingModule import each other (chat needs "is this session live",
    // streaming needs chat history for room.state), so the cycle is broken with forwardRef on both
    // sides — see chat.module.ts / streaming.module.ts.
    @Inject(forwardRef(() => StreamingService)) private readonly streaming: StreamingService,
    private readonly rateLimit: RateLimitService,
    private readonly banCache: ChatBanCacheService,
    private readonly cache: ChatCacheService,
    private readonly queue: QueueService,
    private readonly identity: IdentityService,
  ) {}

  async execute(
    cmd: SendMessageCommand,
  ): Promise<
    Result<
      SendMessageResult,
      StreamSessionNotFoundError | StreamNotLiveError | UserBannedError | ChatRateLimitedError
    >
  > {
    const sessionResult = await this.streaming.getSessionForJoin({ sessionId: cmd.sessionId });
    if (!sessionResult.ok) {
      if (sessionResult.error.code === ErrorCodes.STREAM_NOT_LIVE) {
        return Err(new StreamNotLiveError(cmd.sessionId));
      }
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    const { allowed, retryAfterSeconds } = await this.rateLimit.check('chat', cmd.userId);
    if (!allowed) {
      return Err(new ChatRateLimitedError(retryAfterSeconds));
    }

    const banned = await this.banCache.isBanned(sessionResult.value.channelId, cmd.userId);
    if (banned) {
      return Err(new UserBannedError());
    }

    // One identity lookup per send (not per joiner), so both the live broadcast and the cached
    // snapshot carry a real name. Falls back to the id if the user was deleted in between, same
    // as SalesGateway.resolveDisplayName.
    const user = await this.identity.getUserById({ userId: cmd.userId });
    const displayName = user?.displayName ?? cmd.userId;

    const message: ChatMessage = {
      id: generateId(),
      sessionId: cmd.sessionId,
      userId: cmd.userId,
      body: cmd.body,
      type: 'USER',
      isDeleted: false,
      deletedByUserId: null,
      createdAt: new Date(),
    };

    await this.cache.pushRecentMessage(message, displayName);

    // Broadcast does not wait on the insert (§9) — the use case returns as soon as the job is
    // enqueued, not after it's processed. `id` is generated above, before enqueueing, so the
    // persist job's upsert is safe under BullMQ's at-least-once redelivery.
    const jobData: UpsertChatMessageInput = {
      id: message.id,
      sessionId: message.sessionId,
      userId: message.userId,
      body: message.body,
      type: message.type,
      createdAt: message.createdAt,
    };
    await this.queue.enqueue(QueueNames.CHAT, PERSIST_JOB_NAME, jobData);

    return Ok({ message, displayName, clientRef: cmd.clientRef });
  }
}
