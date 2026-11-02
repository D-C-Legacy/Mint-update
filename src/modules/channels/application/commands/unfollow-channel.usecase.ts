import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok } from '../../../../shared/result/result';
import { CHANNEL_REPOSITORY, ChannelRepositoryPort } from '../../domain/ports/channel.repository.port';

export interface UnfollowChannelCommand {
  readonly userId: string;
  readonly channelId: string;
}

export interface UnfollowChannelResult {
  readonly channelId: string;
}

@Injectable()
export class UnfollowChannelUseCase {
  constructor(@Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort) {}

  async execute(cmd: UnfollowChannelCommand): Promise<Result<UnfollowChannelResult, never>> {
    // unfollow() returns null both when the channel doesn't exist and when the user simply
    // wasn't following it — either way, "not following" is already the desired end state, so
    // both are treated as a successful no-op rather than distinguishing them with a findById
    // first (avoids leaking whether an unknown channelId exists).
    await this.channels.unfollow(cmd.channelId, cmd.userId);
    return Ok({ channelId: cmd.channelId });
  }
}
