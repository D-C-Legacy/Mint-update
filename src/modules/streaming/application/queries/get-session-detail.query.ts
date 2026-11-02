import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../../domain/ports/stream-session.repository.port';
import { StreamSessionNotFoundError } from '../../domain/errors/streaming.errors';
import { PresenceService } from '../../infra/presence.service';
import { StreamSessionWithViewers } from './list-live-sessions.query';

export interface GetSessionDetailCommand {
  readonly sessionId: string;
}

// Behind `GET /streams/:id` (05-API-SPEC.md §6, "Session detail"). Any status is readable here,
// unlike GetSessionForJoinQuery, which only admits LIVE sessions to the WS room.
@Injectable()
export class GetSessionDetailQuery {
  constructor(
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    private readonly presence: PresenceService,
  ) {}

  async execute(
    cmd: GetSessionDetailCommand,
  ): Promise<Result<StreamSessionWithViewers, StreamSessionNotFoundError>> {
    const session = await this.sessions.findById(cmd.sessionId);
    if (!session) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }
    const viewerCount = await this.presence.getViewerCount(session.id);
    return Ok({ session, viewerCount });
  }
}
