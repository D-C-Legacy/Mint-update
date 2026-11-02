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
import { StreamSessionNotFoundError } from '../../domain/errors/streaming.errors';
import {
  StreamModeratorAlreadyExistsError,
  CannotModerateSelfError,
  InsufficientStreamRoleError,
} from '../../domain/errors/streaming.errors';
import { StreamModeratorRole } from '../../domain/entities/stream-moderation.entity';

export interface AddModeratorCommand {
  readonly requesterUserId: string;
  readonly sessionId: string;
  readonly userId: string;
}

export interface AddModeratorResult {
  readonly moderatorId: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly role: StreamModeratorRole;
  readonly createdAt: Date;
}

@Injectable()
export class AddModeratorUseCase {
  constructor(
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    @Inject(STREAM_MODERATOR_REPOSITORY) private readonly moderators: StreamModeratorRepositoryPort,
  ) {}

  async execute(
    cmd: AddModeratorCommand,
  ): Promise<
    Result<
      AddModeratorResult,
      | StreamSessionNotFoundError
      | StreamModeratorAlreadyExistsError
      | CannotModerateSelfError
      | InsufficientStreamRoleError
    >
  > {
    const session = await this.sessions.findById(cmd.sessionId);
    if (!session) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    // Check if requester is the channel owner (seller)
    if (session.channelId !== cmd.requesterUserId) {
      // Need to verify through channel - for now check if user is the channel owner
      // This would need channel lookup; assuming requesterUserId is the channel owner
      return Err(new InsufficientStreamRoleError('CHANNEL_OWNER', 'UNKNOWN'));
    }

    if (cmd.userId === cmd.requesterUserId) {
      return Err(new CannotModerateSelfError());
    }

    const existing = await this.moderators.findBySessionIdAndUserId(cmd.sessionId, cmd.userId);
    if (existing) {
      return Err(new StreamModeratorAlreadyExistsError(cmd.sessionId, cmd.userId));
    }

    const moderatorId = ulid();
    const moderator = await this.moderators.create({
      id: moderatorId,
      sessionId: cmd.sessionId,
      userId: cmd.userId,
      addedBy: cmd.requesterUserId,
      role: 'MODERATOR',
    });

    return Ok({
      moderatorId: moderator.id,
      sessionId: moderator.sessionId,
      userId: moderator.userId,
      role: moderator.role,
      createdAt: moderator.createdAt,
    });
  }
}
