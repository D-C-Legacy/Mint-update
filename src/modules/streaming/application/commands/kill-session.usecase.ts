import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../../domain/ports/stream-session.repository.port';
import { STREAM_PROVIDER, StreamProviderPort } from '../../domain/ports/stream-provider.port';
import { transitionStreamStatus } from '../../domain/rules/stream-status-transition.rule';
import {
  InvalidStreamStatusError,
  StreamSessionNotFoundError,
} from '../../domain/errors/streaming.errors';
import { StreamSession } from '../../domain/entities/stream-session.entity';
import { SessionStatsFinalizer } from '../session-stats-finalizer.service';

export interface KillSessionCommand {
  readonly sessionId: string;
}

// `POST /admin/streams/:id/kill` (05-API-SPEC.md §11) — unowned by any ticket. Admin-only, no
// channel-ownership check (unlike EndSessionUseCase's self-service `END`) — same reasoning as
// every other admin override in this build.
@Injectable()
export class KillSessionUseCase {
  constructor(
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    @Inject(STREAM_PROVIDER) private readonly provider: StreamProviderPort,
    private readonly statsFinalizer: SessionStatsFinalizer,
  ) {}

  async execute(
    cmd: KillSessionCommand,
  ): Promise<Result<StreamSession, StreamSessionNotFoundError | InvalidStreamStatusError>> {
    const session = await this.sessions.findById(cmd.sessionId);
    if (!session) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    const transition = transitionStreamStatus('KILL', session.status);
    if (!transition.ok) {
      return Err(transition.error);
    }

    if (session.providerRoomId) {
      await this.provider.endRoom(session.providerRoomId);
    }

    const updated = await this.sessions.cancel(session.id, new Date());
    await this.statsFinalizer.finalize(updated.id);

    return Ok(updated);
  }
}
