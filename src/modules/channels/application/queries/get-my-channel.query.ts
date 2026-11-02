import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SellersService } from '../../../sellers/application/sellers.service';
import { CHANNEL_REPOSITORY, ChannelRepositoryPort } from '../../domain/ports/channel.repository.port';
import { ChannelNotFoundError, SellerProfileNotFoundError } from '../../domain/errors/channels.errors';
import { Channel } from '../../domain/entities/channel.entity';

export interface GetMyChannelCommand {
  readonly userId: string;
}

export interface GetMyChannelResult {
  readonly channel: Channel;
}

// Added in P4-03: streaming needs "the caller's own channel" to create a stream session, and per
// AGENTS.md §4 cross-module calls can only go through another module's *.service.ts facade — this
// exposes the same userId→seller→channel resolution UpdateChannelUseCase already does internally.
@Injectable()
export class GetMyChannelQuery {
  constructor(
    private readonly sellers: SellersService,
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
  ) {}

  async execute(
    cmd: GetMyChannelCommand,
  ): Promise<Result<GetMyChannelResult, SellerProfileNotFoundError | ChannelNotFoundError>> {
    const sellerResult = await this.sellers.getMySeller({ userId: cmd.userId });
    if (!sellerResult.ok) {
      return Err(new SellerProfileNotFoundError(cmd.userId));
    }

    const channel = await this.channels.findBySellerId(sellerResult.value.seller.id);
    if (!channel) {
      return Err(new ChannelNotFoundError(`seller ${sellerResult.value.seller.id}`));
    }

    return Ok({ channel });
  }
}
