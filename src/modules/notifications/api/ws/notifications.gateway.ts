import { Inject, UseInterceptors } from '@nestjs/common';
import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import { appConfig } from '../../../../config/app.config';
import { WsObservabilityInterceptor } from '../../../../platform/observability/ws-observability.interceptor';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  NOTIFICATION_CREATED_EVENT,
  NotificationCreatedPayload,
} from '../../events/published/notification-created.event';

function userChannel(userId: string): string {
  return `user:${userId}`;
}

// Not in 06-REALTIME-AND-CONCURRENCY.md's event catalogue — added for the Phase 6 inbox so a new
// notification can push live instead of waiting for the next poll. Same per-user-channel pattern
// SalesGateway/StreamingGateway already use (`user:{userId}`, joined at connect by
// StreamingGateway.handleConnection); this gateway only emits, it has no inbound messages.
@WebSocketGateway({ cors: { origin: appConfig.corsOrigin } })
@UseInterceptors(WsObservabilityInterceptor)
export class NotificationsGateway implements OnGatewayInit {
  @WebSocketServer() private server?: Server;

  constructor(@Inject(EVENT_BUS) private readonly eventBus: EventBusPort) {}

  afterInit(): void {
    // notify() is called from the API and worker processes; the sockets live in realtime — same
    // crossProcess reasoning as SalesGateway/ChatGateway.
    this.eventBus.subscribe<NotificationCreatedPayload>(
      NOTIFICATION_CREATED_EVENT,
      (event) => {
        const p = event.payload;
        this.server?.to(userChannel(p.userId)).emit('notification.created', {
          id: p.id,
          templateKey: p.templateKey,
          content: p.content,
          createdAt: p.createdAt,
        });
      },
      { crossProcess: true },
    );
  }
}
