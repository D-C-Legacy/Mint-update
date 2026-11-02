import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  ORDER_CANCELLED_EVENT,
  OrderCancelledPayload,
} from '../../../orders/events/published/order-cancelled.event';
import { LedgerService, PostTransactionEntryCommand } from '../../application/ledger.service';

// Reverses exactly what OnOrderPaidHandler posted, when a seller/admin cancels a PAID order.
// Safe to debit SELLER_PENDING directly (never SELLER_AVAILABLE) without checking which account
// the money actually sits in: CANCEL's legal origin set (order-status-transition.rule.ts) is
// PENDING_PAYMENT/PAID only — never SHIPPED or later — and releasePendingForOrder() only moves
// SELLER_PENDING -> SELLER_AVAILABLE on delivery, so a cancellable order's seller credit has
// never been released yet. This is why Phase 3's dispute/refund-policy decision (what happens to
// a seller ALREADY paid out) doesn't apply here — that money has never left SELLER_PENDING.
@Injectable()
export class OnOrderCancelledHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly ledger: LedgerService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<OrderCancelledPayload>(ORDER_CANCELLED_EVENT, async (event) => {
      const payload = event.payload;
      if (!payload.wasPaid) {
        return; // cancelled from PENDING_PAYMENT — order.paid never posted, nothing to reverse
      }

      const itemAmount = BigInt(payload.itemAmount);
      const commissionAmount = BigInt(payload.commissionAmount);
      const sellerNetAmount = BigInt(payload.sellerNetAmount);

      const entries: PostTransactionEntryCommand[] = [
        { accountType: 'PLATFORM_CASH', ownerId: null, direction: 'CREDIT', amount: itemAmount },
      ];
      if (sellerNetAmount > 0n) {
        entries.push({
          accountType: 'SELLER_PENDING',
          ownerId: payload.sellerId,
          direction: 'DEBIT',
          amount: sellerNetAmount,
        });
      }
      if (commissionAmount > 0n) {
        entries.push({
          accountType: 'PLATFORM_REVENUE',
          ownerId: null,
          direction: 'DEBIT',
          amount: commissionAmount,
        });
      }

      await this.ledger.post({
        type: 'order.cancelled',
        idempotencyKey: `order.cancelled:${payload.orderId}`,
        referenceType: 'order',
        referenceId: payload.orderId,
        currency: payload.currency,
        entries,
      });
    });
  }
}
