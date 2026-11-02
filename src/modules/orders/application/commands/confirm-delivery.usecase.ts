import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { Clock, CLOCK } from '../../../../shared/time/clock';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order } from '../../domain/entities/order.entity';
import { OrderNotFoundError, InvalidOrderStatusError } from '../../domain/errors/orders.errors';
import { orderDeliveredEvent } from '../../events/published/order-delivered.event';

export type ConfirmDeliveryCommand =
  | { readonly orderId: string; readonly source: 'BUYER'; readonly buyerUserId: string }
  | { readonly orderId: string; readonly source: 'AUTO' }
  | { readonly orderId: string; readonly source: 'ADMIN' };

// 05-API-SPEC.md §8: `POST /orders/:id/confirm-delivery | buyer | Buyer confirms receipt` — the
// BUYER path. The AUTO path is P6-08's "auto-confirm job after N days" (AutoConfirmDeliveryProcessor),
// calling this exact same use case with no buyer context to check. The ADMIN path
// (`POST /admin/orders/:id/force-deliver`, 05-API-SPEC.md §11) is added in P8-06 — no ownership
// check, same reasoning as every other admin override in this build. CARRIER-sourced confirmation
// (also listed on `DeliveryConfirmationSource` since P6-01) remains out of scope — no doc names a
// carrier-webhook integration anywhere.
@Injectable()
export class ConfirmDeliveryUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: ConfirmDeliveryCommand): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    const order = await this.orders.findById(cmd.orderId);
    if (!order) {
      return Err(new OrderNotFoundError(cmd.orderId));
    }

    if (cmd.source === 'BUYER' && order.buyerUserId !== cmd.buyerUserId) {
      return Err(new OrderNotFoundError(cmd.orderId));
    }

    if (order.status !== 'SHIPPED') {
      return Err(new InvalidOrderStatusError('confirm delivery', ['SHIPPED'], order.status));
    }

    const updated = await this.orders.markDelivered(cmd.orderId, cmd.source);
    if (!updated) {
      // Lost a race to another concurrent confirm (buyer and the auto-sweep landing at once,
      // for example) between the check above and here — harmless, whichever call wins publishes.
      return Err(new InvalidOrderStatusError('confirm delivery', ['SHIPPED'], order.status));
    }

    await this.eventBus.publish(
      orderDeliveredEvent({
        orderId: updated.id,
        sellerId: updated.sellerId,
        buyerUserId: updated.buyerUserId,
        deliveredAt: (updated.deliveredAt ?? this.clock.now()).toISOString(),
        confirmedBy: cmd.source,
      }),
    );

    return Ok(updated);
  }
}
