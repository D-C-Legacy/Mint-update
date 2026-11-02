import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { generateId } from '../../../../shared/ids/id';
import { ChannelsService } from '../../../channels/application/channels.service';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../../domain/ports/stream-session.repository.port';
import {
  STREAM_QUEUE_ITEM_REPOSITORY,
  StreamQueueItemRepositoryPort,
} from '../../domain/ports/stream-queue-item.repository.port';
import { StreamQueueItem } from '../../domain/entities/stream-queue-item.entity';
import { StreamSessionNotFoundError } from '../../domain/errors/streaming.errors';

// Mirrors FeatureQueueItemCommand's own discriminated union (round5 §5, 26 Oct 2026) — pricing is
// now captured here, at add-to-queue time, instead of only ever being typed in by hand at
// feature-time, since the auto-advance job has no seller present to prompt for a price.
export type AddQueueItemCommand =
  | {
      readonly userId: string;
      readonly sessionId: string;
      readonly productId: string;
      readonly mode: 'AUCTION';
      readonly startAmount: bigint;
    }
  | {
      readonly userId: string;
      readonly sessionId: string;
      readonly productId: string;
      readonly mode: 'BUY_NOW';
      readonly price: bigint;
      readonly quantity: number;
    }
  | {
      readonly userId: string;
      readonly sessionId: string;
      readonly productId: string;
      readonly mode: 'OFFER';
    };

export interface AddQueueItemResult {
  readonly item: StreamQueueItem;
}

// founder_requests.md §2, decided 14 Oct 2026: last-minute additions are in scope, not just
// reordering what was planned at setup — so this always appends (new items land at the end of the
// lineup, whether the stream has started or not), never requires the full queue to be pre-planned.
// Reordering an item forward is ReorderQueueItemsUseCase's job, a separate, explicit seller action.
@Injectable()
export class AddQueueItemUseCase {
  constructor(
    private readonly channels: ChannelsService,
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    @Inject(STREAM_QUEUE_ITEM_REPOSITORY)
    private readonly queueItems: StreamQueueItemRepositoryPort,
  ) {}

  async execute(
    cmd: AddQueueItemCommand,
  ): Promise<Result<AddQueueItemResult, StreamSessionNotFoundError>> {
    const session = await this.sessions.findById(cmd.sessionId);
    if (!session) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    // 404, not 403 — same ownership-hiding precedent as start-session/end-session.
    const channelResult = await this.channels.getMyChannel({ userId: cmd.userId });
    if (!channelResult.ok || channelResult.value.channel.id !== session.channelId) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    const existing = await this.queueItems.listBySession(cmd.sessionId);
    const nextPosition =
      existing.length === 0 ? 0 : Math.max(...existing.map((i) => i.position)) + 1;

    const item = await this.queueItems.create({
      id: generateId(),
      sessionId: cmd.sessionId,
      productId: cmd.productId,
      position: nextPosition,
      mode: cmd.mode,
      startAmount: cmd.mode === 'AUCTION' ? cmd.startAmount : null,
      price: cmd.mode === 'BUY_NOW' ? cmd.price : null,
      quantity: cmd.mode === 'BUY_NOW' ? cmd.quantity : null,
    });

    return Ok({ item });
  }
}
