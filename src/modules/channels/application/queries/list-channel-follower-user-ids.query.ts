import { Inject, Injectable } from '@nestjs/common';
import { CHANNEL_REPOSITORY, ChannelRepositoryPort } from '../../domain/ports/channel.repository.port';

export interface ListChannelFollowerUserIdsCommand {
  readonly channelId: string;
}

// Added for P8-04: the "channel went live" notification handler needs every follower's userId
// to fan out to. `findFollowerUserIds` already existed on the repository, just never exposed.
@Injectable()
export class ListChannelFollowerUserIdsQuery {
  constructor(@Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort) {}

  async execute(cmd: ListChannelFollowerUserIdsCommand): Promise<string[]> {
    return this.channels.findFollowerUserIds(cmd.channelId);
  }
}
