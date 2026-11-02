import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SellersService } from '../../../sellers/application/sellers.service';
import { CHANNEL_REPOSITORY, ChannelRepositoryPort } from '../../domain/ports/channel.repository.port';
import { ChannelNotFoundError, SellerProfileNotFoundError } from '../../domain/errors/channels.errors';
import { Channel } from '../../domain/entities/channel.entity';

export interface UpdateChannelCommand {
  readonly userId: string;
  readonly name?: string;
  readonly bio?: string;
  readonly bannerKey?: string;
}

@Injectable()
export class UpdateChannelUseCase {
  constructor(
    private readonly sellers: SellersService,
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
  ) {}

  async execute(
    cmd: UpdateChannelCommand,
  ): Promise<Result<Channel, SellerProfileNotFoundError | ChannelNotFoundError>> {
    const sellerResult = await this.sellers.getMySeller({ userId: cmd.userId });
    if (!sellerResult.ok) {
      return Err(new SellerProfileNotFoundError(cmd.userId));
    }

    const channel = await this.channels.findBySellerId(sellerResult.value.seller.id);
    if (!channel) {
      return Err(new ChannelNotFoundError(`seller ${sellerResult.value.seller.id}`));
    }

    const updated = await this.channels.update(channel.id, {
      ...(cmd.name !== undefined ? { name: cmd.name } : {}),
      ...(cmd.bio !== undefined ? { bio: cmd.bio } : {}),
      ...(cmd.bannerKey !== undefined ? { bannerKey: cmd.bannerKey } : {}),
    });

    return Ok(updated);
  }
}
