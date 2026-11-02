import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../../domain/ports/stream-session.repository.port';
import { StreamNotLiveError, StreamSessionNotFoundError } from '../../domain/errors/streaming.errors';
import { StreamSession } from '../../domain/entities/stream-session.entity';

export interface GetSessionForJoinCommand {
  readonly sessionId: string;
}

// The "can a viewer join right now" guard behind the WS gateway's room.join handler
// (06-REALTIME-AND-CONCURRENCY.md §1: "verify session is LIVE") — kept in application/ rather
// than inline in the gateway per AGENTS.md §4 ("no business logic in controllers or gateways").
@Injectable()
export class GetSessionForJoinQuery {
  constructor(@Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort) {}

  async execute(
    cmd: GetSessionForJoinCommand,
  ): Promise<Result<StreamSession, StreamSessionNotFoundError | StreamNotLiveError>> {
    const session = await this.sessions.findById(cmd.sessionId);
    if (!session) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }
    if (session.status !== 'LIVE') {
      return Err(new StreamNotLiveError(cmd.sessionId));
    }
    return Ok(session);
  }
}
