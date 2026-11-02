import { Injectable, Inject } from '@nestjs/common';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../domain/ports/channel.repository.port';
import { Channel } from '../../domain/entities/channel.entity';

export interface GetChannelByIdCommand {
  readonly channelId: string;
}

// Plain id lookup, no active-channel filtering (unlike GetChannelBySlugQuery) — its one caller so
// far (streaming's AutoAdvanceQueueUseCase) already has a real StreamSession pointing at this
// channel id, so there's nothing to hide behind a not-found here the way a public slug lookup would.
@Injectable()
export class GetChannelByIdQuery {
  constructor(@Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort) {}

  async execute(cmd: GetChannelByIdCommand): Promise<Channel | null> {
    return this.channels.findById(cmd.channelId);
  }
}
