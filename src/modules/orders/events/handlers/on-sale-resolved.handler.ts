import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { SALE_RESOLVED_EVENT, SaleResolvedPayload } from '../../../sales/events/published/sale-resolved.event';
import { OrdersService } from '../../application/orders.service';

// 06-REALTIME-AND-CONCURRENCY.md §6 step 7: "orders module consumes the event and creates the
// order." Same shape as channels' SellerApprovedHandler (P3-04) — a thin adapter translating the
// event payload into a command, all real logic lives in the use case the service calls.
@Injectable()
export class OnSaleResolvedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly orders: OrdersService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<SaleResolvedPayload>(SALE_RESOLVED_EVENT, async (event) => {
      // Replay after commit: the sale's own transaction already created the order (see the sale
      // use cases), so this normally finds it and does nothing. It is the safety net only.
      await this.orders.createFromSale({
        trx: undefined,
        saleId: event.payload.saleId,
        sellerId: event.payload.sellerId,
        productId: event.payload.productId,
        quantity: event.payload.quantity,
        currency: event.payload.currency,
        buyerUserId: event.payload.winnerUserId,
        finalAmount: BigInt(event.payload.finalAmount),
      });
    });
  }
}
