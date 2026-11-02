import { Inject, UseInterceptors } from '@nestjs/common';
import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import { appConfig } from '../../../../config/app.config';
import { WsObservabilityInterceptor } from '../../../../platform/observability/ws-observability.interceptor';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { ORDER_PAID_EVENT, OrderPaidPayload } from '../../events/published/order-paid.event';
import { ORDER_SHIPPED_EVENT, OrderShippedPayload } from '../../events/published/order-shipped.event';
import { ORDER_DELIVERED_EVENT, OrderDeliveredPayload } from '../../events/published/order-delivered.event';
import { ORDER_CANCELLED_EVENT, OrderCancelledPayload } from '../../events/published/order-cancelled.event';

function userChannel(userId: string): string {
  return `user:${userId}`;
}

// Not in 06-REALTIME-AND-CONCURRENCY.md's event catalogue — added for the Phase 6 app-integration
// "order status updates live" requirement. Translates the four existing order domain events into
// one outbound shape on the buyer's own channel (same per-user pattern as SalesGateway's
// bid.accepted/bid.outbid), rather than inventing a shape per transition. Refund/dispute are not
// included: neither publishes a domain event today (deliberately, per
// MarkOrderRefundedUseCase/MarkOrderDisputedUseCase's own comments — no event name is documented
// for either), and adding one is P7/ledger territory, not this phase's scope.
@WebSocketGateway({ cors: { origin: appConfig.corsOrigin } })
@UseInterceptors(WsObservabilityInterceptor)
export class OrdersGateway implements OnGatewayInit {
  @WebSocketServer() private server?: Server;

  constructor(@Inject(EVENT_BUS) private readonly eventBus: EventBusPort) {}

  // Published from the API (HTTP cancel) and worker (webhook paid, auto-confirm delivered)
  // processes; the sockets live in realtime — same crossProcess reasoning as SalesGateway/ChatGateway.
  private subscribeAcrossProcesses<TPayload>(
    name: string,
    handler: (event: { payload: TPayload }) => void,
  ): void {
    this.eventBus.subscribe<TPayload>(name, handler, { crossProcess: true });
  }

  afterInit(): void {
    this.subscribeAcrossProcesses<OrderPaidPayload>(ORDER_PAID_EVENT, (event) => {
      const p = event.payload;
      this.server?.to(userChannel(p.buyerUserId)).emit('order.status.changed', {
        orderId: p.orderId,
        status: 'PAID',
      });
    });

    this.subscribeAcrossProcesses<OrderShippedPayload>(ORDER_SHIPPED_EVENT, (event) => {
      const p = event.payload;
      this.server?.to(userChannel(p.buyerUserId)).emit('order.status.changed', {
        orderId: p.orderId,
        status: 'SHIPPED',
        carrier: p.carrier,
        trackingNumber: p.trackingNumber,
      });
    });

    this.subscribeAcrossProcesses<OrderDeliveredPayload>(ORDER_DELIVERED_EVENT, (event) => {
      const p = event.payload;
      this.server?.to(userChannel(p.buyerUserId)).emit('order.status.changed', {
        orderId: p.orderId,
        status: 'DELIVERED',
      });
    });

    this.subscribeAcrossProcesses<OrderCancelledPayload>(ORDER_CANCELLED_EVENT, (event) => {
      const p = event.payload;
      this.server?.to(userChannel(p.buyerUserId)).emit('order.status.changed', {
        orderId: p.orderId,
        status: 'CANCELLED',
        reason: p.reason,
      });
    });
  }
}
