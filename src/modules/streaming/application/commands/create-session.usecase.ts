import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { generateId } from '../../../../shared/ids/id';
import { ChannelsService } from '../../../channels/application/channels.service';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../../domain/ports/stream-session.repository.port';
import { ChannelNotFoundError } from '../../domain/errors/streaming.errors';
import { StreamSession } from '../../domain/entities/stream-session.entity';

export interface CreateSessionCommand {
  readonly userId: string;
  readonly title: string;
  readonly scheduledFor: Date | null;
}

export interface CreateSessionResult {
  readonly session: StreamSession;
}

@Injectable()
export class CreateSessionUseCase {
  constructor(
    private readonly channels: ChannelsService,
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
  ) {}

  async execute(cmd: CreateSessionCommand): Promise<Result<CreateSessionResult, ChannelNotFoundError>> {
    const channelResult = await this.channels.getMyChannel({ userId: cmd.userId });
    if (!channelResult.ok) {
      return Err(new ChannelNotFoundError(`user ${cmd.userId}`));
    }

    const session = await this.sessions.create({
      id: generateId(),
      channelId: channelResult.value.channel.id,
      title: cmd.title,
      scheduledFor: cmd.scheduledFor,
    });

    return Ok({ session });
  }
}
