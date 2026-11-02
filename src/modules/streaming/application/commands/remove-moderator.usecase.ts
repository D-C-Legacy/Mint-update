import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
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
  StreamModeratorNotFoundError,
  InsufficientStreamRoleError,
} from '../../domain/errors/streaming.errors';

export interface RemoveModeratorCommand {
  readonly requesterUserId: string;
  readonly sessionId: string;
  readonly moderatorId: string;
}

export interface RemoveModeratorResult {
  readonly moderatorId: string;
  readonly removed: true;
}

@Injectable()
export class RemoveModeratorUseCase {
  constructor(
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    @Inject(STREAM_MODERATOR_REPOSITORY) private readonly moderators: StreamModeratorRepositoryPort,
  ) {}

  async execute(
    cmd: RemoveModeratorCommand,
  ): Promise<
    Result<
      RemoveModeratorResult,
      StreamSessionNotFoundError | StreamModeratorNotFoundError | InsufficientStreamRoleError
    >
  > {
    const session = await this.sessions.findById(cmd.sessionId);
    if (!session) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    // Check if requester is the channel owner (seller)
    if (session.channelId !== cmd.requesterUserId) {
      return Err(new InsufficientStreamRoleError('CHANNEL_OWNER', 'UNKNOWN'));
    }

    const moderator = await this.moderators.findById(cmd.moderatorId);
    if (!moderator || moderator.sessionId !== cmd.sessionId) {
      return Err(new StreamModeratorNotFoundError(cmd.moderatorId));
    }

    await this.moderators.delete(cmd.moderatorId);
    return Ok({ moderatorId: cmd.moderatorId, removed: true });
  }
}
