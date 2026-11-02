import { Injectable, Inject } from '@nestjs/common';
import {
  STREAM_QUEUE_ITEM_REPOSITORY,
  StreamQueueItemRepositoryPort,
} from '../../domain/ports/stream-queue-item.repository.port';
import { StreamQueueItem } from '../../domain/entities/stream-queue-item.entity';

export interface ListQueueItemsCommand {
  readonly sessionId: string;
}

@Injectable()
export class ListQueueItemsQuery {
  constructor(
    @Inject(STREAM_QUEUE_ITEM_REPOSITORY)
    private readonly queueItems: StreamQueueItemRepositoryPort,
  ) {}

  async execute(cmd: ListQueueItemsCommand): Promise<StreamQueueItem[]> {
    return this.queueItems.listBySession(cmd.sessionId);
  }

  async active(sessionId: string): Promise<StreamQueueItem | null> {
    return this.queueItems.findActiveBySession(sessionId);
  }
}
