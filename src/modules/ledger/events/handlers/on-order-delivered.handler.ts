import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { QueueService } from '../../../../platform/queue/queue.service';
import { QueueNames } from '../../../../platform/queue/queue.names';
import {
  ORDER_DELIVERED_EVENT,
  OrderDeliveredPayload,
} from '../../../orders/events/published/order-delivered.event';
import { LedgerService } from '../../application/ledger.service';
import { SellersService } from '../../../sellers/application/sellers.service';

export const RELEASE_PENDING_JOB = 'ledger.release-pending';

// BullMQ 5.x rejects colons in custom job ids (P5-06's own real finding) — a hyphen, same
// convention as place-bid.usecase.ts's auctionCloseJobId(). Exported so
// infra/jobs/release-pending.processor.ts imports this exact helper rather than re-deriving the
// format (same deliberate, flagged layering exception as P5-07's auction-close processor).
export function releasePendingJobId(orderId: string): string {
  return `release-pending-${orderId}`;
}

// 00-PRD.md §4.4 step 4 / 03-DATA-MODEL.md §10's "Order delivered" transaction — but not posted
// immediately when the seller has a configured Seller.payoutHoldDays (schema field since P2-01,
// never read by anything until now). A hold period means the release is delayed work, not an
// immediate reaction, so this schedules a job rather than calling LedgerService directly — same
// "react to an event by scheduling delayed work" shape as P5-09's auction-close job and P6-08's
// auto-confirm sweep. `releasePendingJobId(orderId)` as the BullMQ jobId means a redelivered
// order.delivered.v1 reuses the same scheduled job rather than double-scheduling it; the actual
// release itself is additionally idempotent via LedgerService.post()'s own idempotencyKey.
@Injectable()
export class OnOrderDeliveredHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly ledger: LedgerService,
    private readonly sellers: SellersService,
    private readonly queue: QueueService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<OrderDeliveredPayload>(ORDER_DELIVERED_EVENT, async (event) => {
      const payload = event.payload;
      const seller = await this.sellers.getSellerById({ sellerId: payload.sellerId });
      const payoutHoldDays = seller?.payoutHoldDays ?? 0;

      if (payoutHoldDays <= 0) {
        await this.ledger.releasePendingForOrder({ orderId: payload.orderId, sellerId: payload.sellerId });
        return;
      }

      await this.queue.schedule(
        QueueNames.LEDGER,
        RELEASE_PENDING_JOB,
        { orderId: payload.orderId, sellerId: payload.sellerId },
        payoutHoldDays * 24 * 60 * 60 * 1000,
        releasePendingJobId(payload.orderId),
      );
    });
  }
}
