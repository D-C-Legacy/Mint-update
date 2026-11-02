import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  PAYMENT_REFUNDED_EVENT,
  PaymentRefundedPayload,
} from '../../../payments/events/published/payment-refunded.event';
import { LedgerService, PostTransactionEntryCommand } from '../../application/ledger.service';
import { splitRefundAmount } from '../../domain/rules/refund-split.rule';

// Engineering backlog Phase 3b: books the money side of a refund against whatever the
// seller still holds with us (founder-approved policy, see refund-split.rule.ts). Posted for
// both admin-issued refunds (RefundPaymentUseCase.execute) and refunds reconciled from the
// Stripe dashboard / late settlement (reconcileRefunds → new or newly-succeeded Refund rows).
// NOT fired for refundForCancelledOrder: a PAID-order cancel's books are already squared by
// OnOrderCancelledHandler's full reversal — this handler seeing those refunds again would
// credit PLATFORM_CASH twice for one money movement, which is exactly why
// payment-refunded.event.ts's own comment names refundForCancelledOrder as deliberately
// non-emitting.
// Idempotency anchor is the Stripe refund id, not the local Refund row id: execute() and
// reconcileRefunds can theoretically produce two local rows for one Stripe refund (webhook
// landing first), but never two Stripe refunds — one id ensures one posting.
@Injectable()
export class OnPaymentRefundedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly ledger: LedgerService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<PaymentRefundedPayload>(PAYMENT_REFUNDED_EVENT, async (event) => {
      const payload = event.payload;

      if (BigInt(payload.refundAmount) <= 0n) {
        // An approving-but-zero refund never reaches here from a real use case; refuse to
        // construct (buildLedgerTransaction would reject the empty transaction anyway).
        return;
      }

      const context = await this.ledger.getRefundPostingContext({
        orderId: payload.orderId,
        sellerId: payload.sellerId,
      });
      if (!context.paidPosted) {
        // order.paid never posted (e.g. the payment succeeded while the order was already
        // CANCELLED, so MarkOrderPaidUseCase refused the transition). There is no coherent
        // seller/commission composition to draw the refund from — posting one would debit a
        // seller who never received this sale's credit. Books untouched here; the refund's
        // real Stripe cash movement will show up in the nightly reconciliation as a cash
        // MISMATCH until it is resolved, which is this codebase's "surface, never absorb"
        // way of being wrong. (Flagged in the 3b tracker write-up as the one gap left.)
        return;
      }

      const split = splitRefundAmount({
        refundAmountMinor: BigInt(payload.refundAmount),
        itemAmountMinor: BigInt(payload.itemAmount),
        commissionAmountMinor: BigInt(payload.commissionAmount),
      });

      // Policy A: debit what the seller actually holds, SELLER_PENDING first (never yet
      // releasable), then SELLER_AVAILABLE (received but already released). Everything the
      // seller cannot cover becomes an overdraft on SELLER_PENDING — the projection going
      // negative IS the seller's debt in this codebase's shape, and their next sale's
      // SELLER_PENDING credit nets it back (policy B's "future sales top up", no separate
      // account needed while payouts are excluded; 09-DECISIONS has the reasoning).
      const fromPending =
        context.pending < split.sellerShareMinor ? context.pending : split.sellerShareMinor;
      const remainder = split.sellerShareMinor - fromPending;
      const fromAvailable = context.available < remainder ? context.available : remainder;
      // What no held balance could cover — policy B lives here. Zero unless needed.
      const overdraft = remainder - fromAvailable;

      const entries: PostTransactionEntryCommand[] = [
        {
          accountType: 'PLATFORM_CASH',
          ownerId: null,
          direction: 'CREDIT',
          amount: BigInt(payload.refundAmount),
        },
      ];
      if (split.commissionShareMinor > 0n) {
        entries.push({
          accountType: 'PLATFORM_REVENUE',
          ownerId: null,
          direction: 'DEBIT',
          amount: split.commissionShareMinor,
        });
      }
      if (fromPending > 0n) {
        entries.push({
          accountType: 'SELLER_PENDING',
          ownerId: payload.sellerId,
          direction: 'DEBIT',
          amount: fromPending,
        });
      }
      if (fromAvailable > 0n) {
        entries.push({
          accountType: 'SELLER_AVAILABLE',
          ownerId: payload.sellerId,
          direction: 'DEBIT',
          amount: fromAvailable,
        });
      }
      if (overdraft > 0n) {
        entries.push({
          accountType: 'SELLER_PENDING',
          ownerId: payload.sellerId,
          direction: 'DEBIT',
          amount: overdraft,
        });
      }

      await this.ledger.post({
        type: 'refund.recorded',
        idempotencyKey: `refund.recorded:${payload.providerRefundId}`,
        referenceType: 'refund',
        referenceId: payload.refundId,
        currency: payload.currency,
        entries,
      });
    });
  }
}
