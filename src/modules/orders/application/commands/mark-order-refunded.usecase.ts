import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order } from '../../domain/entities/order.entity';
import { OrderNotFoundError, InvalidOrderStatusError } from '../../domain/errors/orders.errors';
import { transitionOrderStatus } from '../../domain/rules/order-status-transition.rule';

export interface MarkOrderRefundedCommand {
  readonly orderId: string;
  readonly refundId: string;
}

// Called by modules/payments' RefundPaymentUseCase, and ONLY for a full refund — a partial
// refund updates Payment.status to PARTIALLY_REFUNDED but deliberately does not call this
// (Order.status staying PAID/SHIPPED/etc for a partial refund is the reading this build uses;
// no doc defines the alternative). No `order.refunded.v1` domain event is published — unlike
// `order.paid.v1`, no event name is documented anywhere for this transition; not invented.
@Injectable()
export class MarkOrderRefundedUseCase {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort) {}

  async execute(cmd: MarkOrderRefundedCommand): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    const order = await this.orders.findById(cmd.orderId);
    if (!order) {
      return Err(new OrderNotFoundError(cmd.orderId));
    }

    const transition = transitionOrderStatus('REFUND', order.status);
    if (!transition.ok) {
      return Err(transition.error);
    }

    const updated = await this.orders.markRefunded(cmd.orderId, cmd.refundId);
    if (!updated) {
      // Lost a race to another concurrent REFUND/CANCEL call between the check above and here.
      return Err(new InvalidOrderStatusError('refund the order', ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'], order.status));
    }

    return Ok(updated);
  }
}
