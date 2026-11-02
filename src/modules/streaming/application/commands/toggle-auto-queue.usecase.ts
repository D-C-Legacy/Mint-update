import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { ChannelsService } from '../../../channels/application/channels.service';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../../domain/ports/stream-session.repository.port';
import { StreamSession } from '../../domain/entities/stream-session.entity';
import { StreamSessionNotFoundError } from '../../domain/errors/streaming.errors';

export interface ToggleAutoQueueCommand {
  readonly userId: string;
  readonly sessionId: string;
  readonly enabled: boolean;
}

export interface ToggleAutoQueueResult {
  readonly session: StreamSession;
}

// Founder-feedback round5 §5 (26 Oct 2026): "sellers can pause and start the queue." A per-show
// on/off switch is the whole of pause/resume here — there's nothing else for "paused" to mean
// independently of this flag (AutoAdvanceQueueUseCase just no-ops while it's false).
@Injectable()
export class ToggleAutoQueueUseCase {
  constructor(
    private readonly channels: ChannelsService,
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
  ) {}

  async execute(
    cmd: ToggleAutoQueueCommand,
  ): Promise<Result<ToggleAutoQueueResult, StreamSessionNotFoundError>> {
    const session = await this.sessions.findById(cmd.sessionId);
    if (!session) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    // 404, not 403 — same ownership-hiding precedent as every other seller-guarded queue command.
    const channelResult = await this.channels.getMyChannel({ userId: cmd.userId });
    if (!channelResult.ok || channelResult.value.channel.id !== session.channelId) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    const updated = await this.sessions.setAutoQueueEnabled(cmd.sessionId, cmd.enabled);
    return Ok({ session: updated });
  }
}
