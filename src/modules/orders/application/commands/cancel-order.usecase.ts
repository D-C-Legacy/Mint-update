import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order } from '../../domain/entities/order.entity';
import { OrderNotFoundError, InvalidOrderStatusError } from '../../domain/errors/orders.errors';
import { orderCancelledEvent } from '../../events/published/order-cancelled.event';

export interface CancelOrderCommand {
  readonly orderId: string;
  readonly buyerUserId: string;
  readonly reason: string | null;
}

const BUYER_CANCELLABLE_FROM = ['PENDING_PAYMENT'] as const;

// POST /orders/:id/cancel, buyer path. 05-API-SPEC.md §8 documents this exact route for
// seller/admin only, allowed from PENDING_PAYMENT or PAID, and it was never built either — this
// is a new, narrower, buyer-scoped action added on the user's instruction (flagged, same
// "user-directed addition" precedent as change-password/preferences/addresses): a buyer may only
// cancel before paying, never after (a PAID order needs a refund, not a cancel, to unwind money
// already charged). The seller/admin version (PENDING_PAYMENT or PAID) remains unbuilt — if it's
// added later, it should branch on role at this same route rather than inventing a second path.
@Injectable()
export class CancelOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    cmd: CancelOrderCommand,
  ): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    const order = await this.orders.findById(cmd.orderId);
    if (!order) {
      return Err(new OrderNotFoundError(cmd.orderId));
    }

    // 404, not 403: someone else's order looks identical to a missing one, same masking
    // precedent as ShipOrderUseCase's seller check.
    if (order.buyerUserId !== cmd.buyerUserId) {
      return Err(new OrderNotFoundError(cmd.orderId));
    }

    if (order.status !== 'PENDING_PAYMENT') {
      return Err(
        new InvalidOrderStatusError('cancel the order', BUYER_CANCELLABLE_FROM, order.status),
      );
    }

    const updated = await this.orders.markCancelled(
      cmd.orderId,
      BUYER_CANCELLABLE_FROM,
      cmd.reason,
    );
    if (!updated) {
      // Lost a race to another concurrent PAY/CANCEL call between the check above and here.
      return Err(
        new InvalidOrderStatusError('cancel the order', BUYER_CANCELLABLE_FROM, order.status),
      );
    }

    await this.eventBus.publish(
      orderCancelledEvent({
        orderId: updated.id,
        buyerUserId: updated.buyerUserId,
        sellerId: updated.sellerId,
        reason: cmd.reason,
        cancelledByUserId: cmd.buyerUserId,
        wasPaid: false, // this path only ever fires from PENDING_PAYMENT — never a real charge yet
        currency: updated.currency,
        itemAmount: updated.itemAmount.toString(),
        commissionAmount: updated.commissionAmount.toString(),
        sellerNetAmount: updated.sellerNetAmount.toString(),
      }),
    );

    return Ok(updated);
  }
}
