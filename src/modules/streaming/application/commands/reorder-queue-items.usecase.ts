import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { ChannelsService } from '../../../channels/application/channels.service';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../../domain/ports/stream-session.repository.port';
import {
  STREAM_QUEUE_ITEM_REPOSITORY,
  StreamQueueItemRepositoryPort,
} from '../../domain/ports/stream-queue-item.repository.port';
import {
  QueueItemNotFoundError,
  StreamSessionNotFoundError,
} from '../../domain/errors/streaming.errors';

export interface ReorderQueueItemsCommand {
  readonly userId: string;
  readonly sessionId: string;
  /** The full lineup's item ids, in the new desired order — not a partial move, the caller sends
   *  the whole list every time (same "client sends the end state" simplicity the app's own
   *  drag-to-reorder UI will naturally produce). */
  readonly orderedItemIds: readonly string[];
}

export interface ReorderQueueItemsResult {
  readonly reordered: true;
}

@Injectable()
export class ReorderQueueItemsUseCase {
  constructor(
    private readonly channels: ChannelsService,
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    @Inject(STREAM_QUEUE_ITEM_REPOSITORY)
    private readonly queueItems: StreamQueueItemRepositoryPort,
  ) {}

  async execute(
    cmd: ReorderQueueItemsCommand,
  ): Promise<Result<ReorderQueueItemsResult, StreamSessionNotFoundError | QueueItemNotFoundError>> {
    const session = await this.sessions.findById(cmd.sessionId);
    if (!session) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    const channelResult = await this.channels.getMyChannel({ userId: cmd.userId });
    if (!channelResult.ok || channelResult.value.channel.id !== session.channelId) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    const existing = await this.queueItems.listBySession(cmd.sessionId);
    const existingIds = new Set(existing.map((i) => i.id));

    // Every id in the new order must actually belong to this session's queue — guards against a
    // seller (accidentally or otherwise) reordering in an id from a different stream entirely.
    for (const id of cmd.orderedItemIds) {
      if (!existingIds.has(id)) {
        return Err(new QueueItemNotFoundError(id));
      }
    }

    await this.queueItems.reorder(cmd.orderedItemIds.map((id, position) => ({ id, position })));

    return Ok({ reordered: true });
  }
}
