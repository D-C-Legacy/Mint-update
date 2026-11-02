import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { ulid } from 'ulid';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../../domain/ports/stream-session.repository.port';
import {
  STREAM_MODERATOR_REPOSITORY,
  StreamModeratorRepositoryPort,
} from '../../domain/ports/stream-moderation.repository.port';
import {
  CHAT_TIMEOUT_REPOSITORY,
  ChatTimeoutRepositoryPort,
} from '../../domain/ports/stream-moderation.repository.port';
import { StreamSessionNotFoundError } from '../../domain/errors/streaming.errors';
import {
  StreamModeratorNotFoundError,
  UserAlreadyTimedOutError,
  InsufficientStreamRoleError,
} from '../../domain/errors/streaming.errors';
import { ChatTimeoutReason } from '../../domain/entities/stream-moderation.entity';

export interface TimeoutUserCommand {
  readonly moderatorUserId: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly durationMinutes: number;
  readonly reason: ChatTimeoutReason;
}

export interface TimeoutUserResult {
  readonly timeoutId: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly expiresAt: Date;
  readonly reason: ChatTimeoutReason;
}

@Injectable()
export class TimeoutUserUseCase {
  constructor(
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    @Inject(STREAM_MODERATOR_REPOSITORY) private readonly moderators: StreamModeratorRepositoryPort,
    @Inject(CHAT_TIMEOUT_REPOSITORY) private readonly timeouts: ChatTimeoutRepositoryPort,
  ) {}

  async execute(
    cmd: TimeoutUserCommand,
  ): Promise<
    Result<
      TimeoutUserResult,
      | StreamSessionNotFoundError
      | StreamModeratorNotFoundError
      | UserAlreadyTimedOutError
      | InsufficientStreamRoleError
    >
  > {
    const session = await this.sessions.findById(cmd.sessionId);
    if (!session) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    // Check if requester is a moderator for this session
    const moderator = await this.moderators.findBySessionIdAndUserId(
      cmd.sessionId,
      cmd.moderatorUserId,
    );
    if (!moderator) {
      // Also allow channel owner to timeout
      if (session.channelId !== cmd.moderatorUserId) {
        return Err(new InsufficientStreamRoleError('MODERATOR or CHANNEL_OWNER', 'VIEWER'));
      }
    }

    if (cmd.userId === cmd.moderatorUserId) {
      return Err(new UserAlreadyTimedOutError()); // Reusing error, but conceptually "can't timeout self"
    }

    // Check if user is already timed out
    const existingTimeout = await this.timeouts.findActiveBySessionIdAndUserId(
      cmd.sessionId,
      cmd.userId,
    );
    if (existingTimeout) {
      return Err(new UserAlreadyTimedOutError());
    }

    const timeoutId = ulid();
    const expiresAt = new Date(Date.now() + cmd.durationMinutes * 60 * 1000);

    const timeout = await this.timeouts.create({
      id: timeoutId,
      sessionId: cmd.sessionId,
      userId: cmd.userId,
      moderatorId: cmd.moderatorUserId,
      expiresAt,
      reason: cmd.reason,
    });

    return Ok({
      timeoutId: timeout.id,
      sessionId: timeout.sessionId,
      userId: timeout.userId,
      expiresAt: timeout.expiresAt,
      reason: timeout.reason,
    });
  }
}
