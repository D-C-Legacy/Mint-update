import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  ORDER_PAID_EVENT,
  OrderPaidPayload,
} from '../../../orders/events/published/order-paid.event';
import { LedgerService, PostTransactionEntryCommand } from '../../application/ledger.service';

// 03-DATA-MODEL.md §10's "Order paid" example is 5 entries (the 5th pair being a processor-fee
// debit/credit). Since 3b the fee number is REAL: OrderPaidPayload v2 carries
// providerFeeMinor, which payments populated from the charge's balance transaction
// (P6-05's flagged gap, closed). The pair nets PLATFORM_CASH down from gross to what Stripe
// actually keeps (already net of its fee), which is what the reconciliation's 3rd check
// compares against. A fee of 0 or an absent field (a v1 event still in flight at deploy
// time) posts the pre-3b 3-entry shape — never a fabricated pair.
// itemAmount always equals sellerNetAmount + commissionAmount by construction
// (create-order-from-sale.usecase.ts), so the posting balances with or without the fee pair.
// commissionBps (and so commissionAmount) can legitimately be 0 (a 0%-commission seller),
// which would make sellerNetAmount === itemAmount and leave nothing to credit
// PLATFORM_REVENUE with — buildLedgerTransaction() rejects a zero-amount entry outright
// (P7-02), so a 0-commission order correctly posts only 2 entries, not 3 with a bogus
// zero one. commissionBps === 10000 (100%) is the symmetric edge case for sellerNetAmount.
@Injectable()
export class OnOrderPaidHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly ledger: LedgerService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<OrderPaidPayload>(ORDER_PAID_EVENT, async (event) => {
      const payload = event.payload;
      const itemAmount = BigInt(payload.itemAmount);
      const commissionAmount = BigInt(payload.commissionAmount);
      const sellerNetAmount = BigInt(payload.sellerNetAmount);
      const providerFee = BigInt(payload.providerFeeMinor ?? '0');

      const entries: PostTransactionEntryCommand[] = [
        { accountType: 'PLATFORM_CASH', ownerId: null, direction: 'DEBIT', amount: itemAmount },
      ];
      if (sellerNetAmount > 0n) {
        entries.push({
          accountType: 'SELLER_PENDING',
          ownerId: payload.sellerId,
          direction: 'CREDIT',
          amount: sellerNetAmount,
        });
      }
      if (commissionAmount > 0n) {
        entries.push({
          accountType: 'PLATFORM_REVENUE',
          ownerId: null,
          direction: 'CREDIT',
          amount: commissionAmount,
        });
      }
      if (providerFee > 0n) {
        // The doc §10 fee pair, entries 4-5: the expense the processor took, and the same
        // amount leaving the cash balance so PLATFORM_CASH ends at Stripe's fee-net figure.
        entries.push({
          accountType: 'PROCESSOR_FEES',
          ownerId: null,
          direction: 'DEBIT',
          amount: providerFee,
        });
        entries.push({
          accountType: 'PLATFORM_CASH',
          ownerId: null,
          direction: 'CREDIT',
          amount: providerFee,
        });
      }

      await this.ledger.post({
        type: 'order.paid',
        // One idempotencyKey per order — MarkOrderPaidUseCase only ever publishes order.paid.v1
        // once per order (P6-07: "the SAME order paid 5 times total still ... exactly one
        // published order.paid event"), so this alone is enough; LedgerService.post() itself is
        // what actually makes a redelivery or a 3x shared-AppModule re-subscription harmless.
        idempotencyKey: `order.paid:${payload.orderId}`,
        referenceType: 'order',
        referenceId: payload.orderId,
        currency: payload.currency,
        entries,
      });
    });
  }
}
