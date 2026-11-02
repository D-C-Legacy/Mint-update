import { Injectable, Inject } from '@nestjs/common';
import { CursorPage } from '../../../../shared/pagination/cursor';
import {
  CHAT_TIMEOUT_REPOSITORY,
  ChatTimeoutRepositoryPort,
} from '../../domain/ports/stream-moderation.repository.port';
import { ChatTimeout } from '../../domain/entities/stream-moderation.entity';

export interface ListTimeoutsCommand {
  readonly sessionId: string;
  readonly userId: string | undefined;
  readonly activeOnly: boolean | undefined;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

export interface ListTimeoutsQuery {
  execute(cmd: ListTimeoutsCommand): Promise<CursorPage<ChatTimeout>>;
}

@Injectable()
export class ListTimeoutsQueryImpl implements ListTimeoutsQuery {
  constructor(
    @Inject(CHAT_TIMEOUT_REPOSITORY) private readonly timeouts: ChatTimeoutRepositoryPort,
  ) {}

  async execute(cmd: ListTimeoutsCommand): Promise<CursorPage<ChatTimeout>> {
    const DEFAULT_LIMIT = 20;
    const MAX_LIMIT = 100;
    const limit = cmd.limit ? Math.min(Math.max(cmd.limit, 1), MAX_LIMIT) : DEFAULT_LIMIT;

    const items = await this.timeouts.list({
      sessionId: cmd.sessionId,
      userId: cmd.userId ?? undefined,
      activeOnly: cmd.activeOnly ?? undefined,
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
