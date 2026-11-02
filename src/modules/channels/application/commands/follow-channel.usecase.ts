import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { CHANNEL_REPOSITORY, ChannelRepositoryPort } from '../../domain/ports/channel.repository.port';
import { ChannelNotFoundError } from '../../domain/errors/channels.errors';
import { Channel } from '../../domain/entities/channel.entity';

export interface FollowChannelCommand {
  readonly userId: string;
  readonly channelId: string;
}

@Injectable()
export class FollowChannelUseCase {
  constructor(@Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort) {}

  async execute(cmd: FollowChannelCommand): Promise<Result<Channel, ChannelNotFoundError>> {
    const channel = await this.channels.findById(cmd.channelId);
    if (!channel) {
      return Err(new ChannelNotFoundError(cmd.channelId));
    }

    const updated = await this.channels.follow(cmd.channelId, cmd.userId);
    return Ok(updated);
  }
}
