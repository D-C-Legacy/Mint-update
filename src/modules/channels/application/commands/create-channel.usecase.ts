import { Injectable, Inject } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok } from '../../../../shared/result/result';
import { CHANNEL_REPOSITORY, ChannelRepositoryPort } from '../../domain/ports/channel.repository.port';
import { slugify } from '../../domain/rules/slugify.rule';
import { Channel } from '../../domain/entities/channel.entity';

export interface CreateChannelCommand {
  readonly sellerId: string;
  readonly name: string;
}

// Idempotent by design (createIfMissing) — this use case is the target of the seller.approved
// event handler, which may see a redelivered event under an at-least-once bus.
@Injectable()
export class CreateChannelUseCase {
  constructor(@Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort) {}

  async execute(cmd: CreateChannelCommand): Promise<Result<Channel, never>> {
    const channel = await this.channels.createIfMissing({
      id: generateId(),
      sellerId: cmd.sellerId,
      name: cmd.name,
      baseSlug: slugify(cmd.name),
    });

    return Ok(channel);
  }
}
