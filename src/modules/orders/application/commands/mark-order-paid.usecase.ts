import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { Clock, CLOCK } from '../../../../shared/time/clock';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order } from '../../domain/entities/order.entity';
import { OrderNotFoundError, InvalidOrderStatusError } from '../../domain/errors/orders.errors';
import { transitionOrderStatus } from '../../domain/rules/order-status-transition.rule';
import { orderPaidEvent } from '../../events/published/order-paid.event';

export interface MarkOrderPaidCommand {
  readonly orderId: string;
  readonly paymentId: string;
  // 3b: the processor fee the payments side already recorded on the Payment row (minor units),
  // carried onto the payload so the ledger's order.paid posting can include the docs §10 fee
  // pair. Null/absent (webhook raced the fee lookup, odd capture topology) → posts without
  // the pair, exactly the pre-3b shape — never a fabricated number.
  readonly providerFeeMinor?: bigint | null;
}

// Called by modules/payments' PayOrderUseCase once a charge genuinely succeeds — cross-module,
// via OrdersService, never by payments reaching into modules/orders/domain/** directly.
@Injectable()
export class MarkOrderPaidUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    cmd: MarkOrderPaidCommand,
  ): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    const order = await this.orders.findById(cmd.orderId);
    if (!order) {
      return Err(new OrderNotFoundError(cmd.orderId));
    }

    // Pre-check for a clear, rule-derived error on the common path; the atomic `updateMany`
    // guard inside `markPaid` is still the real correctness mechanism against a concurrent
    // double-PAY race (same two-layer pattern as sales' resolveOpenToResolved callers).
    const transition = transitionOrderStatus('PAY', order.status);
    if (!transition.ok) {
      return Err(transition.error);
    }

    const updated = await this.orders.markPaid(cmd.orderId, cmd.paymentId);
    if (!updated) {
      // Lost a race to another concurrent PAY call between the check above and here.
      return Err(new InvalidOrderStatusError('pay the order', ['PENDING_PAYMENT'], order.status));
    }

    await this.eventBus.publish(
      orderPaidEvent({
        orderId: updated.id,
        paymentId: cmd.paymentId,
        sellerId: updated.sellerId,
        buyerUserId: updated.buyerUserId,
        currency: updated.currency,
        itemAmount: updated.itemAmount.toString(),
        commissionAmount: updated.commissionAmount.toString(),
        sellerNetAmount: updated.sellerNetAmount.toString(),
        providerFeeMinor: (cmd.providerFeeMinor ?? 0n).toString(),
        paidAt: this.clock.now().toISOString(),
      }),
    );

    return Ok(updated);
  }
}
