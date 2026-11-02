import { Injectable, Inject } from '@nestjs/common';
import { CursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../../domain/ports/stream-session.repository.port';
import { StreamSession } from '../../domain/entities/stream-session.entity';
import { PresenceService } from '../../infra/presence.service';

export interface StreamSessionWithViewers {
  readonly session: StreamSession;
  readonly viewerCount: number;
}

export interface ListLiveSessionsCommand {
  readonly cursor: string | null;
  readonly limit: number | undefined;
}

// Read-only directory behind `GET /streams/live` (05-API-SPEC.md §6). Viewer count is live Redis
// presence, never Postgres (03-DATA-MODEL.md, StreamSession), so it is read per session here.
@Injectable()
export class ListLiveSessionsQuery {
  constructor(
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    private readonly presence: PresenceService,
  ) {}

  async execute(cmd: ListLiveSessionsCommand): Promise<CursorPage<StreamSessionWithViewers>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.sessions.listLive({ cursor: cmd.cursor, limit });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    const items = await Promise.all(
      page.map(async (session) => ({
        session,
        viewerCount: await this.presence.getViewerCount(session.id),
      })),
    );

    return { items, nextCursor: hasMore && last ? last.id : null };
  }
}
