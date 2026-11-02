import { Inject, UseInterceptors } from '@nestjs/common';
import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import { appConfig } from '../../../../config/app.config';
import { WsObservabilityInterceptor } from '../../../../platform/observability/ws-observability.interceptor';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { MESSAGE_CREATED_EVENT, MessageCreatedPayload } from '../../events/published/message-created.event';

function userChannel(userId: string): string {
  return `user:${userId}`;
}

// Not in 06-REALTIME-AND-CONCURRENCY.md's event catalogue — Phase 8 addition, same per-user-
// channel precedent as NotificationsGateway/OrdersGateway (`user:{userId}`, joined at connect by
// StreamingGateway.handleConnection already). Only emits to the recipient; the sender already has
// the message from its own send response.
@WebSocketGateway({ cors: { origin: appConfig.corsOrigin } })
@UseInterceptors(WsObservabilityInterceptor)
export class MessagingGateway implements OnGatewayInit {
  @WebSocketServer() private server?: Server;

  constructor(@Inject(EVENT_BUS) private readonly eventBus: EventBusPort) {}

  afterInit(): void {
    // Published from the API process (HTTP send); the sockets live in realtime — same
    // crossProcess reasoning as every other per-user gateway in this codebase.
    this.eventBus.subscribe<MessageCreatedPayload>(
      MESSAGE_CREATED_EVENT,
      (event) => {
        const p = event.payload;
        this.server?.to(userChannel(p.recipientUserId)).emit('message.created', {
          conversationId: p.conversationId,
          messageId: p.messageId,
          senderUserId: p.senderUserId,
          body: p.body,
          createdAt: p.createdAt,
        });
      },
      { crossProcess: true },
    );
  }
}
