import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order, OrderStatus } from '../../domain/entities/order.entity';
import { OrderNotFoundError, InvalidOrderStatusError } from '../../domain/errors/orders.errors';
import { SellersService } from '../../../sellers/application/sellers.service';
import { orderCancelledEvent } from '../../events/published/order-cancelled.event';

export type CancelOrderAsSellerOrAdminActor =
  | { readonly role: 'SELLER'; readonly userId: string }
  | { readonly role: 'ADMIN'; readonly userId: string };

export interface CancelOrderAsSellerOrAdminCommand {
  readonly orderId: string;
  readonly actor: CancelOrderAsSellerOrAdminActor;
  readonly reason: string | null;
}

// 05-API-SPEC.md §8's actual documented version of `POST /orders/:id/cancel`
// (`seller/admin | Cancel before shipment`) — CancelOrderUseCase's buyer path is a separate,
// narrower carve-out layered on the same route (see that file's header comment), untouched here.
//
// PENDING_PAYMENT or PAID — both legal origins per order-status-transition.rule.ts's CANCEL
// transition. Cancelling a PAID order needs its money actually given back: the published
// order.cancelled event (widened for this, see order-cancelled.event.ts) carries what the
// payments module (refund) and ledger module (reversing entry) need to react, decoupled via
// EVENT_BUS the same way the ledger module already reacts to order.paid — no new cross-module
// import, so no risk of the Orders<->Payments cycle this codebase has already been bitten by once.
const SELLER_ADMIN_CANCELLABLE_FROM: readonly OrderStatus[] = ['PENDING_PAYMENT', 'PAID'];

@Injectable()
export class CancelOrderAsSellerOrAdminUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    private readonly sellers: SellersService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    cmd: CancelOrderAsSellerOrAdminCommand,
  ): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    const order = await this.orders.findById(cmd.orderId);
    if (!order) {
      return Err(new OrderNotFoundError(cmd.orderId));
    }

    if (cmd.actor.role === 'SELLER') {
      // Order.sellerId is a Seller.id, not a User.id — same resolve-and-compare as
      // ShipOrderUseCase. 404, not 403: a non-owning seller looks identical to a missing order.
      const callerSeller = await this.sellers.getMySeller({ userId: cmd.actor.userId });
      if (!callerSeller.ok || callerSeller.value.seller.id !== order.sellerId) {
        return Err(new OrderNotFoundError(cmd.orderId));
      }
    }
    // ADMIN: no ownership check — any order is in scope.

    if (!SELLER_ADMIN_CANCELLABLE_FROM.includes(order.status)) {
      return Err(
        new InvalidOrderStatusError(
          'cancel the order',
          SELLER_ADMIN_CANCELLABLE_FROM,
          order.status,
        ),
      );
    }

    // Captured before the transition — this is what actually tells the payments/ledger
    // handlers whether there's real money to give back, not anything in the event payload.
    const wasPaid = order.status === 'PAID';

    const updated = await this.orders.markCancelled(
      cmd.orderId,
      SELLER_ADMIN_CANCELLABLE_FROM,
      cmd.reason,
    );
    if (!updated) {
      // Lost a race to another concurrent PAY/CANCEL call between the check above and here.
      return Err(
        new InvalidOrderStatusError(
          'cancel the order',
          SELLER_ADMIN_CANCELLABLE_FROM,
          order.status,
        ),
      );
    }

    await this.eventBus.publish(
      orderCancelledEvent({
        orderId: updated.id,
        buyerUserId: updated.buyerUserId,
        sellerId: updated.sellerId,
        reason: cmd.reason,
        cancelledByUserId: cmd.actor.userId,
        wasPaid,
        currency: updated.currency,
        itemAmount: updated.itemAmount.toString(),
        commissionAmount: updated.commissionAmount.toString(),
        sellerNetAmount: updated.sellerNetAmount.toString(),
      }),
    );

    return Ok(updated);
  }
}
