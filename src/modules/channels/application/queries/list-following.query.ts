import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok } from '../../../../shared/result/result';
import { CursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { CHANNEL_REPOSITORY, ChannelRepositoryPort } from '../../domain/ports/channel.repository.port';
import { Channel } from '../../domain/entities/channel.entity';

export interface ListFollowingCommand {
  readonly userId: string;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

@Injectable()
export class ListFollowingQuery {
  constructor(@Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort) {}

  async execute(cmd: ListFollowingCommand): Promise<Result<CursorPage<Channel>, never>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.channels.listFollowing({ userId: cmd.userId, cursor: cmd.cursor, limit });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];

    return Ok({ items, nextCursor: hasMore && last ? last.id : null });
  }
}
