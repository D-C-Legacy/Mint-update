import { Injectable, Inject } from '@nestjs/common';
import { CursorPage } from '../../../../shared/pagination/cursor';
import {
  STREAM_MODERATOR_REPOSITORY,
  StreamModeratorRepositoryPort,
} from '../../domain/ports/stream-moderation.repository.port';
import { StreamModerator } from '../../domain/entities/stream-moderation.entity';

export interface ListModeratorsCommand {
  readonly sessionId: string;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

export interface ListModeratorsQuery {
  execute(cmd: ListModeratorsCommand): Promise<CursorPage<StreamModerator>>;
}

@Injectable()
export class ListModeratorsQueryImpl implements ListModeratorsQuery {
  constructor(
    @Inject(STREAM_MODERATOR_REPOSITORY) private readonly moderators: StreamModeratorRepositoryPort,
  ) {}

  async execute(cmd: ListModeratorsCommand): Promise<CursorPage<StreamModerator>> {
    const DEFAULT_LIMIT = 20;
    const MAX_LIMIT = 100;
    const limit = cmd.limit ? Math.min(Math.max(cmd.limit, 1), MAX_LIMIT) : DEFAULT_LIMIT;

    const items = await this.moderators.list({
      sessionId: cmd.sessionId,
      cursor: cmd.cursor,
      limit,
    });

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const last = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && last ? last.id : null;

    return { items: pageItems, nextCursor };
  }
}
