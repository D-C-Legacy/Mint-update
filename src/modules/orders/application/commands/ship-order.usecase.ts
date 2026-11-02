import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order } from '../../domain/entities/order.entity';
import { OrderNotFoundError, InvalidOrderStatusError } from '../../domain/errors/orders.errors';
import { SellersService } from '../../../sellers/application/sellers.service';
import { orderShippedEvent } from '../../events/published/order-shipped.event';

export interface ShipOrderCommand {
  readonly orderId: string;
  readonly sellerUserId: string;
  readonly carrier: string;
  readonly trackingNumber: string;
}

// 05-API-SPEC.md §8: `POST /orders/:id/ship | seller | Mark shipped with carrier + tracking`.
@Injectable()
export class ShipOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    private readonly sellers: SellersService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(cmd: ShipOrderCommand): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    const order = await this.orders.findById(cmd.orderId);
    if (!order) {
      return Err(new OrderNotFoundError(cmd.orderId));
    }

    // Order.sellerId is a Seller.id, not a User.id (the established convention since
    // Sale.sellerId — see MEMORY.md) — resolve the caller's own seller profile and compare ids.
    // 404, not 403, either way: a non-seller and a seller who doesn't own this order look
    // identical to an unauthorized caller, same masking precedent as catalog/sales.
    const callerSeller = await this.sellers.getMySeller({ userId: cmd.sellerUserId });
    if (!callerSeller.ok || callerSeller.value.seller.id !== order.sellerId) {
      return Err(new OrderNotFoundError(cmd.orderId));
    }

    if (order.status !== 'PAID') {
      return Err(new InvalidOrderStatusError('ship the order', ['PAID'], order.status));
    }

    const updated = await this.orders.markShipped(cmd.orderId, {
      carrier: cmd.carrier,
      trackingNumber: cmd.trackingNumber,
    });
    if (!updated) {
      // Lost a race to another concurrent SHIP/CANCEL call between the check above and here.
      return Err(new InvalidOrderStatusError('ship the order', ['PAID'], order.status));
    }

    await this.eventBus.publish(
      orderShippedEvent({
        orderId: updated.id,
        buyerUserId: updated.buyerUserId,
        carrier: cmd.carrier,
        trackingNumber: cmd.trackingNumber,
      }),
    );

    return Ok(updated);
  }
}
