import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { CHANNEL_REPOSITORY, ChannelRepositoryPort } from '../../domain/ports/channel.repository.port';
import { ChannelNotFoundError } from '../../domain/errors/channels.errors';
import { Channel } from '../../domain/entities/channel.entity';

export interface GetChannelBySlugCommand {
  readonly slug: string;
}

@Injectable()
export class GetChannelBySlugQuery {
  constructor(@Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort) {}

  async execute(cmd: GetChannelBySlugCommand): Promise<Result<Channel, ChannelNotFoundError>> {
    const channel = await this.channels.findBySlug(cmd.slug);
    if (!channel || !channel.isActive) {
      return Err(new ChannelNotFoundError(cmd.slug));
    }
    return Ok(channel);
  }
}
