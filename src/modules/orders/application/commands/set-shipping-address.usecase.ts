import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order } from '../../domain/entities/order.entity';
import { OrderNotFoundError, InvalidOrderStatusError } from '../../domain/errors/orders.errors';

export interface SetShippingAddressCommand {
  readonly orderId: string;
  readonly buyerUserId: string;
  readonly address: Record<string, unknown>;
}

// 05-API-SPEC.md §8: `POST /orders/:id/address | buyer | Set or update shipping address before shipment`.
// A non-buyer gets the same 404 as a missing order (same masking as GetMyOrderQuery).
@Injectable()
export class SetShippingAddressUseCase {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort) {}

  async execute(
    cmd: SetShippingAddressCommand,
  ): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    const order = await this.orders.findById(cmd.orderId);
    if (!order || order.buyerUserId !== cmd.buyerUserId) {
      return Err(new OrderNotFoundError(cmd.orderId));
    }

    if (order.status !== 'PENDING_PAYMENT' && order.status !== 'PAID') {
      return Err(new InvalidOrderStatusError('set the shipping address', ['PENDING_PAYMENT', 'PAID'], order.status));
    }

    const updated = await this.orders.setShippingAddress(cmd.orderId, cmd.address);
    if (!updated) {
      // Lost a race to a concurrent SHIP between the check above and the guarded write.
      return Err(new InvalidOrderStatusError('set the shipping address', ['PENDING_PAYMENT', 'PAID'], order.status));
    }

    return Ok(updated);
  }
}
