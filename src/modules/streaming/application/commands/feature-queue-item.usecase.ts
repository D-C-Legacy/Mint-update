import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { ChannelsService } from '../../../channels/application/channels.service';
import { SalesService } from '../../../sales/application/sales.service';
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
  QueueItemNotFoundError,
  StreamSessionNotFoundError,
} from '../../domain/errors/streaming.errors';
import { queueItemFeaturedEvent } from '../../events/published/queue-item-featured.event';

export type FeatureQueueItemCommand =
  | {
      readonly userId: string;
      readonly sessionId: string;
      readonly itemId: string;
      readonly currency: string;
      readonly mode: 'AUCTION';
      readonly startAmount: bigint;
      readonly durationSeconds?: number;
    }
  | {
      readonly userId: string;
      readonly sessionId: string;
      readonly itemId: string;
      readonly currency: string;
      readonly mode: 'BUY_NOW';
      readonly price: bigint;
      readonly quantity: number;
    }
  | {
      readonly userId: string;
      readonly sessionId: string;
      readonly itemId: string;
      readonly currency: string;
      readonly mode: 'OFFER';
    };

export interface FeatureQueueItemResult {
  readonly item: StreamQueueItem;
  readonly saleId: string;
}

// founder_requests.md §3 — this is what actually creates the "current item" viewers see: it opens
// (or, for a previously-featured item, reuses) the item's Sale and marks it the session's one
// ACTIVE queue entry.
//
// Deliberate, conservative default worth flagging plainly rather than silently deciding: featuring
// a NEW item does NOT cancel whatever sale the PREVIOUSLY active item had open. It just changes
// which item displays as "current" — the old sale keeps running (still acceptable bids, buy-nows,
// whatever it was mid-way through) until the seller separately resolves it (closes naturally,
// or the existing POST /sales/:id/cancel). The founder never asked for an auto-cancel-on-feature
// behavior, and inventing one would be a real, money-adjacent side effect this task wasn't given
// license to add.
@Injectable()
export class FeatureQueueItemUseCase {
  constructor(
    private readonly channels: ChannelsService,
    private readonly sales: SalesService,
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    @Inject(STREAM_QUEUE_ITEM_REPOSITORY)
    private readonly queueItems: StreamQueueItemRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    cmd: FeatureQueueItemCommand,
  ): Promise<Result<FeatureQueueItemResult, StreamSessionNotFoundError | QueueItemNotFoundError>> {
    const session = await this.sessions.findById(cmd.sessionId);
    if (!session) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    const channelResult = await this.channels.getMyChannel({ userId: cmd.userId });
    if (!channelResult.ok || channelResult.value.channel.id !== session.channelId) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    const item = await this.queueItems.findById(cmd.itemId);
    if (!item || item.sessionId !== cmd.sessionId) {
      return Err(new QueueItemNotFoundError(cmd.itemId));
    }

    let saleId = item.saleId;
    if (!saleId) {
      const saleResult = await this.sales.createSale(
        cmd.mode === 'AUCTION'
          ? {
              sellerUserId: cmd.userId,
              sessionId: cmd.sessionId,
              productId: item.productId,
              mode: 'AUCTION',
              currency: cmd.currency,
              startAmount: cmd.startAmount,
              ...(cmd.durationSeconds !== undefined
                ? { durationSeconds: cmd.durationSeconds }
                : {}),
            }
          : cmd.mode === 'BUY_NOW'
            ? {
                sellerUserId: cmd.userId,
                sessionId: cmd.sessionId,
                productId: item.productId,
                mode: 'BUY_NOW',
                currency: cmd.currency,
                price: cmd.price,
                quantity: cmd.quantity,
              }
            : {
                sellerUserId: cmd.userId,
                sessionId: cmd.sessionId,
                productId: item.productId,
                mode: 'OFFER',
                currency: cmd.currency,
              },
      );
      // CreateSaleUseCase's own errors (seller/product/stock) can't actually trigger here — this
      // use case already proved the caller owns an APPROVED-gated channel and a real queued
      // product by this point, so a failure would be a genuine bug upstream, not a user-reachable
      // case worth a dedicated Result branch.
      if (!saleResult.ok) {
        throw new Error(
          `FeatureQueueItemUseCase: unexpected createSale failure — ${saleResult.error.message}`,
        );
      }
      saleId = saleResult.value.saleId;
    }

    const previouslyActive = await this.queueItems.findActiveBySession(cmd.sessionId);
    if (previouslyActive && previouslyActive.id !== item.id) {
      await this.queueItems.markDone(previouslyActive.id);
    }

    const updated = await this.queueItems.markActive(item.id, saleId);

    // AFTER commit (AGENTS.md §4) — createSale/markActive above have already persisted by here.
    await this.eventBus.publish(
      queueItemFeaturedEvent({
        sessionId: cmd.sessionId,
        itemId: updated.id,
        productId: updated.productId,
        saleId,
      }),
    );

    return Ok({ item: updated, saleId });
  }
}
