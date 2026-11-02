import { Inject, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { appConfig } from '../../../../config/app.config';
import { WsAuthGuard, AuthenticatedSocketData } from '../../../../platform/auth/ws-auth.guard';
import { WsObservabilityInterceptor } from '../../../../platform/observability/ws-observability.interceptor';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { toWsException } from '../../../../shared/errors/to-ws-exception';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import type { DomainEventHandler } from '../../../../shared/events/event-bus.port';
import { ChatService } from '../../application/chat.service';
import {
  CHAT_MESSAGE_DELETED_EVENT,
  ChatMessageDeletedPayload,
} from '../../events/published/chat-message-deleted.event';
import { SendMessageSchema, SendMessageDto } from './dto/send-message.dto';

function roomName(sessionId: string): string {
  return `room:${sessionId}`;
}

// 06-REALTIME-AND-CONCURRENCY.md §9. A second, independent gateway alongside StreamingGateway —
// both attach to the one Socket.IO server platform/realtime/redis-io.adapter.ts wires up, no
// second adapter needed (same note left in that file back in P4-04).
//
// Subscribes to the chat.message-deleted event (published by DeleteMessageUseCase, reached via an
// HTTP admin route — see that use case's comment) directly in this class rather than a separate
// events/handlers/ file: the broadcast needs a live Socket.IO server reference, which only a
// gateway has, so splitting the subscription into its own handler class would just mean passing
// the server reference back out again for no benefit.
@WebSocketGateway({ cors: { origin: appConfig.corsOrigin } })
@UseInterceptors(WsObservabilityInterceptor)
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer() private server?: Server;

  constructor(
    private readonly chat: ChatService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  // The sockets live in the realtime process, but bids, sales and chat deletions are published from
  // the API and worker processes too, so a gateway must hear events from every process. (Other
  // handlers deliberately do not: see SubscribeOptions in event-bus.port.ts.)
  private subscribeAcrossProcesses<TPayload>(
    name: string,
    handler: DomainEventHandler<TPayload>,
  ): void {
    this.eventBus.subscribe<TPayload>(name, handler, { crossProcess: true });
  }

  afterInit(): void {
    this.subscribeAcrossProcesses<ChatMessageDeletedPayload>(
      CHAT_MESSAGE_DELETED_EVENT,
      (event) => {
        this.server?.to(roomName(event.payload.sessionId)).emit('chat.deleted', {
          messageId: event.payload.messageId,
        });
      },
    );
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('chat.send')
  async onChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodValidationPipe(SendMessageSchema)) dto: SendMessageDto,
  ): Promise<void> {
    const { userId } = client.data as AuthenticatedSocketData;

    const result = await this.chat.sendMessage({
      userId,
      sessionId: dto.sessionId,
      body: dto.body,
      clientRef: dto.clientRef,
    });
    if (!result.ok) {
      throw toWsException(result.error);
    }

    this.server?.to(roomName(dto.sessionId)).emit('chat.message', {
      message: { ...result.value.message, displayName: result.value.displayName },
    });
  }
}
