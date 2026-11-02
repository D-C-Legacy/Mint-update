import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
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
import {
  NoPendingQueueItemsError,
  StreamSessionNotFoundError,
} from '../../domain/errors/streaming.errors';
import { queueWheelSpunEvent } from '../../events/published/queue-wheel-spun.event';

export interface SpinQueueWheelCommand {
  readonly userId: string;
  readonly sessionId: string;
}

export interface SpinQueueWheelResult {
  readonly item: StreamQueueItem;
}

// "Spin the wheel" (founder request, 21 Oct 2026): randomizes which of the seller's own PENDING
// queue items goes live next, as a gamified alternative to manually tapping "Feature" on one. This
// is the ONLY thing it does — it reads the queue and broadcasts a pick, nothing is written to the
// DB here, and no Sale is opened. The seller's client reacts to the broadcast by opening the same
// "Feature" sheet a manual tap already opens; that existing flow (FeatureQueueItemUseCase) is what
// actually creates the Sale, unchanged. Deliberately NOT a prize/winner mechanic for viewers — see
// engineering-backlog-progress.md's Phase write-up for why that version was ruled out.
@Injectable()
export class SpinQueueWheelUseCase {
  constructor(
    private readonly channels: ChannelsService,
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    @Inject(STREAM_QUEUE_ITEM_REPOSITORY)
    private readonly queueItems: StreamQueueItemRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    cmd: SpinQueueWheelCommand,
  ): Promise<Result<SpinQueueWheelResult, StreamSessionNotFoundError | NoPendingQueueItemsError>> {
    const session = await this.sessions.findById(cmd.sessionId);
    if (!session) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    const channelResult = await this.channels.getMyChannel({ userId: cmd.userId });
    if (!channelResult.ok || channelResult.value.channel.id !== session.channelId) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    const queue = await this.queueItems.listBySession(cmd.sessionId);
    const pending = queue.filter((item) => item.status === 'PENDING');
    if (pending.length === 0) {
      return Err(new NoPendingQueueItemsError(cmd.sessionId));
    }

    const picked = pending[Math.floor(Math.random() * pending.length)];
    if (!picked) {
      // Unreachable: the index is always < pending.length (checked above) — same
      // genuine-bug-only guard FeatureQueueItemUseCase throws on for its own unreachable branch.
      throw new Error('SpinQueueWheelUseCase: random pick produced no item — unreachable');
    }

    await this.eventBus.publish(
      queueWheelSpunEvent({
        sessionId: cmd.sessionId,
        itemId: picked.id,
        productId: picked.productId,
        mode: picked.mode,
      }),
    );

    return Ok({ item: picked });
  }
}
