import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { ChannelsService } from '../../../channels/application/channels.service';
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

export interface EndSessionCommand {
  readonly userId: string;
  readonly sessionId: string;
}

export interface EndSessionResult {
  readonly session: StreamSession;
}

@Injectable()
export class EndSessionUseCase {
  constructor(
    private readonly channels: ChannelsService,
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    @Inject(STREAM_PROVIDER) private readonly provider: StreamProviderPort,
    private readonly statsFinalizer: SessionStatsFinalizer,
  ) {}

  async execute(
    cmd: EndSessionCommand,
  ): Promise<Result<EndSessionResult, StreamSessionNotFoundError | InvalidStreamStatusError>> {
    const session = await this.sessions.findById(cmd.sessionId);
    if (!session) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    const channelResult = await this.channels.getMyChannel({ userId: cmd.userId });
    if (!channelResult.ok || channelResult.value.channel.id !== session.channelId) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    const transition = transitionStreamStatus('END', session.status);
    if (!transition.ok) {
      return Err(transition.error);
    }

    if (session.providerRoomId) {
      await this.provider.endRoom(session.providerRoomId);
    }

    const updated = await this.sessions.end(session.id, new Date());
    await this.statsFinalizer.finalize(updated.id);

    return Ok({ session: updated });
  }
}
