import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  ORDER_CANCELLED_EVENT,
  OrderCancelledPayload,
} from '../../../orders/events/published/order-cancelled.event';
import { RefundPaymentUseCase } from '../../application/commands/refund-payment.usecase';

// Reacts to order.cancelled by subscribing via EVENT_BUS rather than a module import — Payments
// already has a one-directional import of OrdersModule (RefundPaymentUseCase needs OrdersService
// for the direct-refund path); Orders must never import Payments back, or this codebase hits the
// exact module-cycle crash the Sellers/Notifications/Channels triangle already caused once
// (prompt.md §16). Same decoupled shape as ledger's own OnOrderPaidHandler reacting to order.paid.
@Injectable()
export class OnOrderCancelledHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly refundPayment: RefundPaymentUseCase,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<OrderCancelledPayload>(ORDER_CANCELLED_EVENT, async (event) => {
      const payload = event.payload;
      if (!payload.wasPaid) {
        return; // cancelled from PENDING_PAYMENT — no charge was ever made, nothing to refund
      }

      await this.refundPayment.refundForCancelledOrder({
        orderId: payload.orderId,
        initiatedByUserId: payload.cancelledByUserId,
        reason: payload.reason ?? 'Order cancelled before shipment',
      });
    });
  }
}
