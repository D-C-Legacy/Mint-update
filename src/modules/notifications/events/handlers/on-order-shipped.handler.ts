import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  ORDER_SHIPPED_EVENT,
  OrderShippedPayload,
} from '../../../orders/events/published/order-shipped.event';
import { TemplateRegistry } from '../../application/template-registry.service';
import { UserNotificationDispatcher } from './user-notification-dispatcher.service';

const TEMPLATE_KEY = 'order.shipped';

// "order shipped" (07-IMPLEMENTATION-PLAN.md's P8-04 deliverable) — `order.shipped` is a new
// event added in this same ticket (ShipOrderUseCase never published anything before).
@Injectable()
export class OnOrderShippedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly templates: TemplateRegistry,
    private readonly dispatcher: UserNotificationDispatcher,
  ) {
    this.templates.register({
      key: TEMPLATE_KEY,
      channel: 'PUSH',
      render: (data) => ({
        title: 'Order shipped',
        body: `Your order shipped via ${data.carrier as string}, tracking ${data.trackingNumber as string}.`,
      }),
    });
    this.templates.register({
      key: TEMPLATE_KEY,
      channel: 'EMAIL',
      render: (data) => ({
        subject: 'Your order has shipped',
        body: `Your order shipped via ${data.carrier as string}. Tracking number: ${data.trackingNumber as string}.`,
      }),
    });
  }

  onModuleInit(): void {
    // Gated by the user's "orders" Settings toggle (UserNotificationDispatcher).
    this.eventBus.subscribe<OrderShippedPayload>(ORDER_SHIPPED_EVENT, async (event) => {
      await this.dispatcher.dispatch(
        event.payload.buyerUserId,
        TEMPLATE_KEY,
        {
          carrier: event.payload.carrier,
          trackingNumber: event.payload.trackingNumber,
          orderId: event.payload.orderId,
          ref: { type: 'order', id: event.payload.orderId },
        },
        'ORDERS',
      );
    });
  }
}
