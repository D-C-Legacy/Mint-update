import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  SALE_RESOLVED_EVENT,
  SaleResolvedPayload,
} from '../../../sales/events/published/sale-resolved.event';
import { TemplateRegistry } from '../../application/template-registry.service';
import { UserNotificationDispatcher } from './user-notification-dispatcher.service';
import { formatUsdMinorUnits } from './format-usd.util';

const TEMPLATE_KEY = 'sale.resolved.won';

// "won" (07-IMPLEMENTATION-PLAN.md's P8-04 deliverable). Named the same as
// modules/orders/events/handlers/on-sale-resolved.handler.ts — a different module, both
// legitimately subscribing to the same `sale.resolved` event (EventBusService supports multiple
// handlers per event name), not a conflict.
@Injectable()
export class OnSaleResolvedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly templates: TemplateRegistry,
    private readonly dispatcher: UserNotificationDispatcher,
  ) {
    this.templates.register({
      key: TEMPLATE_KEY,
      channel: 'PUSH',
      render: (data) => ({
        title: 'You won!',
        body: `Congratulations, you won the auction for ${formatUsdMinorUnits(data.amount as string)}.`,
      }),
    });
    this.templates.register({
      key: TEMPLATE_KEY,
      channel: 'EMAIL',
      render: (data) => ({
        subject: 'You won the auction',
        body: `Congratulations, you won for ${formatUsdMinorUnits(data.amount as string)}. We'll notify you when your order is ready to ship.`,
      }),
    });
  }

  onModuleInit(): void {
    // Gated by the user's "orders" Settings toggle (UserNotificationDispatcher).
    this.eventBus.subscribe<SaleResolvedPayload>(SALE_RESOLVED_EVENT, async (event) => {
      await this.dispatcher.dispatch(
        event.payload.winnerUserId,
        TEMPLATE_KEY,
        {
          amount: event.payload.finalAmount,
          saleId: event.payload.saleId,
          ref: { type: 'sale', id: event.payload.saleId },
        },
        'ORDERS',
      );
    });
  }
}
