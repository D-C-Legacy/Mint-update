import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { Clock, CLOCK } from '../../../../shared/time/clock';
import { ChannelsService } from '../../../channels/application/channels.service';
import { SellersService } from '../../../sellers/application/sellers.service';
import { SalesService } from '../../../sales/application/sales.service';
import { CatalogService } from '../../../catalog/application/catalog.service';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../../domain/ports/stream-session.repository.port';
import {
  STREAM_QUEUE_ITEM_REPOSITORY,
  StreamQueueItemRepositoryPort,
} from '../../domain/ports/stream-queue-item.repository.port';
import { StreamSessionNotFoundError } from '../../domain/errors/streaming.errors';
import { FeatureQueueItemUseCase } from './feature-queue-item.usecase';

export interface AutoAdvanceQueueCommand {
  readonly sessionId: string;
}

export type AutoAdvanceOutcome =
  // Auto-queue is off, the session isn't live, the active item's sale is still open, or the grace
  // period since it resolved hasn't elapsed yet — nothing to do on this tick.
  | 'NOOP'
  // Advanced to a newly-featured item.
  | 'ADVANCED'
  // Nothing was featured, but not because of the above: the queue has no PENDING item that's both
  // in stock and has the pricing its mode needs (round5 §5's "skip, don't stop and wait" decision).
  | 'NOTHING_ELIGIBLE';

export interface AutoAdvanceQueueResult {
  readonly outcome: AutoAdvanceOutcome;
  readonly featuredItemId: string | null;
}

// Founder-feedback round5 §5 (26 Oct 2026, decisions relayed through the user rather than guessed):
// a short grace period after an item resolves before auto-featuring the next one, skip (don't stop
// and wait for) an out-of-stock item, and pause/resume is just the session's own autoQueueEnabled
// flag — see ToggleAutoQueueUseCase. Called on a short poll by StreamReconcileProcessor, one session
// at a time, not a batch — see that processor for why 5s rather than its own 60s reconcile tick.
const GRACE_PERIOD_MS = 12_000;

@Injectable()
export class AutoAdvanceQueueUseCase {
  constructor(
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    @Inject(STREAM_QUEUE_ITEM_REPOSITORY)
    private readonly queueItems: StreamQueueItemRepositoryPort,
    private readonly channels: ChannelsService,
    private readonly sellers: SellersService,
    private readonly sales: SalesService,
    private readonly catalog: CatalogService,
    private readonly featureQueueItemUseCase: FeatureQueueItemUseCase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    cmd: AutoAdvanceQueueCommand,
  ): Promise<Result<AutoAdvanceQueueResult, StreamSessionNotFoundError>> {
    const session = await this.sessions.findById(cmd.sessionId);
    if (!session) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }
    if (!session.autoQueueEnabled || session.status !== 'LIVE') {
      return Ok({ outcome: 'NOOP', featuredItemId: null });
    }

    const active = await this.queueItems.findActiveBySession(cmd.sessionId);
    if (active) {
      // ACTIVE items always have a saleId (set together by FeatureQueueItemUseCase.markActive) —
      // a miss here would be a data-integrity bug, not a case worth its own outcome branch.
      if (!active.saleId) {
        return Ok({ outcome: 'NOOP', featuredItemId: null });
      }
      const saleResult = await this.sales.getSale({ saleId: active.saleId });
      if (!saleResult.ok || saleResult.value.status === 'OPEN') {
        return Ok({ outcome: 'NOOP', featuredItemId: null }); // still running, or a lookup miss
      }
      const resolvedAt = saleResult.value.resolvedAt ?? this.clock.now();
      if (this.clock.now().getTime() - resolvedAt.getTime() < GRACE_PERIOD_MS) {
        return Ok({ outcome: 'NOOP', featuredItemId: null }); // grace period still running
      }
      // Past the grace period with nothing open — fall through to feature the next eligible item.
    }

    const pending = (await this.queueItems.listBySession(cmd.sessionId)).filter(
      (item) => item.status === 'PENDING',
    );
    if (pending.length === 0) {
      return Ok({ outcome: 'NOTHING_ELIGIBLE', featuredItemId: null });
    }

    // Resolved once, reused for both the stock check below and the real feature call — this is a
    // system-triggered tick with no acting HTTP user, but FeatureQueueItemUseCase still needs a
    // genuine seller userId (it becomes the Sale's sellerUserId, not just an ownership check).
    const channel = await this.channels.getChannelById({ channelId: session.channelId });
    if (!channel) {
      return Ok({ outcome: 'NOOP', featuredItemId: null }); // shouldn't happen; nothing to recover
    }
    const seller = await this.sellers.getSellerById({ sellerId: channel.sellerId });
    if (!seller) {
      return Ok({ outcome: 'NOOP', featuredItemId: null });
    }

    for (const item of pending) {
      // Rows added before this feature existed (or a future manual-only path) may have no stored
      // pricing for their mode — skip rather than invent a number (AGENTS.md §8).
      if (item.mode === 'AUCTION' && item.startAmount === null) continue;
      if (item.mode === 'BUY_NOW' && (item.price === null || item.quantity === null)) continue;

      const productResult = await this.catalog.getProduct({
        userId: seller.userId,
        productId: item.productId,
      });
      if (!productResult.ok) continue; // deleted/inaccessible — don't block the rest of the queue
      const available = productResult.value.quantity - productResult.value.reserved;
      if (available <= 0) continue; // round5 §5: skip out-of-stock, don't stop and wait

      const featureResult = await this.featureQueueItemUseCase.execute(
        item.mode === 'AUCTION'
          ? {
              userId: seller.userId,
              sessionId: cmd.sessionId,
              itemId: item.id,
              currency: 'USD',
              mode: 'AUCTION',
              startAmount: item.startAmount as bigint,
            }
          : item.mode === 'BUY_NOW'
            ? {
                userId: seller.userId,
                sessionId: cmd.sessionId,
                itemId: item.id,
                currency: 'USD',
                mode: 'BUY_NOW',
                price: item.price as bigint,
                quantity: item.quantity as number,
              }
            : {
                userId: seller.userId,
                sessionId: cmd.sessionId,
                itemId: item.id,
                currency: 'USD',
                mode: 'OFFER',
              },
      );
      if (!featureResult.ok) continue; // try the next eligible item rather than giving up entirely
      return Ok({ outcome: 'ADVANCED', featuredItemId: item.id });
    }

    return Ok({ outcome: 'NOTHING_ELIGIBLE', featuredItemId: null });
  }
}
