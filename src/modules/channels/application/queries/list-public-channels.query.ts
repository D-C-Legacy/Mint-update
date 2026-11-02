import { Injectable, Inject } from '@nestjs/common';
import { CursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { CHANNEL_REPOSITORY, ChannelRepositoryPort } from '../../domain/ports/channel.repository.port';
import { Channel } from '../../domain/entities/channel.entity';

export interface ListPublicChannelsCommand {
  readonly sellerId: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// Public directory of active channels (GET /v1/channels). Ordered by follower count, so the
// order is a product choice: "most followed first", not an editorial ranking.
@Injectable()
export class ListPublicChannelsQuery {
  constructor(@Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort) {}

  async execute(cmd: ListPublicChannelsCommand): Promise<CursorPage<Channel>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.channels.listPublic({ sellerId: cmd.sellerId, cursor: cmd.cursor, limit });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }
}
