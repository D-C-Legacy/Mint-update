import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order } from '../../domain/entities/order.entity';
import { OrderNotFoundError, InvalidOrderStatusError } from '../../domain/errors/orders.errors';
import { transitionOrderStatus } from '../../domain/rules/order-status-transition.rule';

export interface MarkOrderDisputedCommand {
  readonly orderId: string;
  readonly disputeId: string;
}

// Called by modules/payments when the processor reports a chargeback (`charge.dispute.created`).
// The DISPUTE origin set (PAID / SHIPPED / DELIVERED) is the existing, flagged-as-unconfirmed rule
// in order-status-transition.rule.ts; an order outside it (for example already COMPLETED or
// REFUNDED) is left alone and the caller gets the InvalidOrderStatusError. No domain event is
// published: no event name is documented for this transition, and none is invented.
@Injectable()
export class MarkOrderDisputedUseCase {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort) {}

  async execute(cmd: MarkOrderDisputedCommand): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    const order = await this.orders.findById(cmd.orderId);
    if (!order) {
      return Err(new OrderNotFoundError(cmd.orderId));
    }

    const transition = transitionOrderStatus('DISPUTE', order.status);
    if (!transition.ok) {
      return Err(transition.error);
    }

    const updated = await this.orders.markDisputed(cmd.orderId, cmd.disputeId);
    if (!updated) {
      // Lost a race to another concurrent status change between the check above and here.
      return Err(new InvalidOrderStatusError('dispute the order', ['PAID', 'SHIPPED', 'DELIVERED'], order.status));
    }

    return Ok(updated);
  }
}
