import { forwardRef, Inject, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { appConfig } from '../../../../config/app.config';
import { WsAuthGuard, AuthenticatedSocketData } from '../../../../platform/auth/ws-auth.guard';
import { WsDefaultRateLimitGuard } from '../../../../platform/rate-limit/ws-default-rate-limit.guard';
import { WsObservabilityInterceptor } from '../../../../platform/observability/ws-observability.interceptor';
import { wsConnectionsGauge } from '../../../../platform/observability/metrics';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { toWsException } from '../../../../shared/errors/to-ws-exception';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { StreamingService } from '../../application/streaming.service';
import { SalesService } from '../../../sales/application/sales.service';
import { ChatService } from '../../../chat/application/chat.service';
import {
  QUEUE_ITEM_FEATURED_EVENT,
  QueueItemFeaturedPayload,
} from '../../events/published/queue-item-featured.event';
import {
  QUEUE_WHEEL_SPUN_EVENT,
  QueueWheelSpunPayload,
} from '../../events/published/queue-wheel-spun.event';
import { RoomJoinSchema, RoomJoinDto } from './dto/room-join.dto';
import { RoomLeaveSchema, RoomLeaveDto } from './dto/room-leave.dto';
import { HeartbeatSchema, HeartbeatDto } from './dto/heartbeat.dto';

function roomName(sessionId: string): string {
  return `room:${sessionId}`;
}

function userChannel(userId: string): string {
  return `user:${userId}`;
}

// 06-REALTIME-AND-CONCURRENCY.md §1's connection model, built up across P4-04 and P4-05: Socket.IO
// server + redis adapter (cross-node fanout, wired in platform/realtime + main.realtime.ts),
// room.join / room.leave, a room.state snapshot on join, a heartbeat handler, and now (P4-05)
// Redis-backed viewer presence with a throttled `viewers.count` broadcast (§8). Two pieces the
// doc describes are still deliberately NOT here, each owned by a later ticket and flagged rather
// than guessed at: the channel ban check ("verify user is not banned" — P4-06's ban check doesn't
// exist yet) and the inbound rate limits in the event catalogue (P9-01). room.state's snapshot
// used to be session-only ("current sale" and "recent chat" didn't exist) — current sale is now
// resolved here (14 Oct 2026, founder_requests.md §3); recent chat is still a gap, unrelated to
// this pass.
@WebSocketGateway({ cors: { origin: appConfig.corsOrigin } })
@UseInterceptors(WsObservabilityInterceptor)
export class StreamingGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  // Only needed starting P4-05, for the viewers.count broadcast — room.state/room.join/room.leave
  // never needed to reach beyond the single joining/leaving socket. Optional + optional-chained at
  // each call site rather than `!`, since @WebSocketGateway() guarantees it's set before any
  // message handler can run but TS's strictPropertyInitialization has no way to know that.
  @WebSocketServer() private server?: Server;

  constructor(
    private readonly wsAuthGuard: WsAuthGuard,
    private readonly streaming: StreamingService,
    private readonly sales: SalesService,
    // ChatModule and StreamingModule import each other (see chat.module.ts), so the cycle is
    // broken with forwardRef on both sides.
    @Inject(forwardRef(() => ChatService)) private readonly chat: ChatService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  // Same cross-process reasoning as SalesGateway: queue featuring can be published from the API
  // process, but the sockets live in realtime.
  afterInit(): void {
    this.eventBus.subscribe<QueueItemFeaturedPayload>(
      QUEUE_ITEM_FEATURED_EVENT,
      (event) => {
        const p = event.payload;
        this.server?.to(roomName(p.sessionId)).emit('queue.item-featured', {
          itemId: p.itemId,
          productId: p.productId,
          saleId: p.saleId,
        });
      },
      { crossProcess: true },
    );

    this.eventBus.subscribe<QueueWheelSpunPayload>(
      QUEUE_WHEEL_SPUN_EVENT,
      (event) => {
        const p = event.payload;
        this.server?.to(roomName(p.sessionId)).emit('queue.wheel-spun', {
          itemId: p.itemId,
          productId: p.productId,
          mode: p.mode,
        });
      },
      { crossProcess: true },
    );
  }

  handleConnection(client: Socket): void {
    try {
      const { userId } = this.wsAuthGuard.authenticate(client);
      void client.join(userChannel(userId));
      // Tagged on the socket rather than incrementing unconditionally, so a failed-auth
      // connection (caught below, disconnected immediately) can't cause handleDisconnect to
      // decrement a connection that was never counted in the first place.
      (client.data as { __counted?: boolean }).__counted = true;
      wsConnectionsGauge.inc();
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    // Socket.IO removes room membership automatically on disconnect. Presence is deliberately NOT
    // cleaned up here — the TTL-windowed viewer count (§8: score = last heartbeat, ZCOUNT over a
    // 45s window) and the 30s reaper sweep are exactly the mechanism meant to handle a client that
    // disappears without an explicit room.leave; an explicit disconnect hook would just duplicate
    // what the TTL already does correctly. The connections gauge, unlike presence, has no TTL
    // fallback of its own, so it's decremented here directly — guarded on `__counted` so a
    // failed-auth connection (never incremented) doesn't drive the gauge negative.
    if ((client.data as { __counted?: boolean }).__counted) {
      wsConnectionsGauge.dec();
    }
  }

  @UseGuards(WsAuthGuard, WsDefaultRateLimitGuard)
  @SubscribeMessage('room.join')
  async onRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodValidationPipe(RoomJoinSchema)) dto: RoomJoinDto,
  ): Promise<WsResponse<unknown>> {
    const result = await this.streaming.getSessionForJoin({ sessionId: dto.sessionId });
    if (!result.ok) {
      throw toWsException(result.error);
    }

    await client.join(roomName(dto.sessionId));

    const { userId } = client.data as AuthenticatedSocketData;
    await this.recordPresenceAndMaybeBroadcast(dto.sessionId, userId);

    const session = result.value;
    const currentItem = await this.resolveCurrentItem(dto.sessionId);
    // Only worth a second lookup when nothing's currently featured — if something is, the answer
    // is trivially true.
    const hasFeaturedBefore = currentItem !== null || (await this.hasEverFeatured(dto.sessionId));
    const recentMessages = await this.chat.getRecentMessages(dto.sessionId);
    return {
      event: 'room.state',
      data: {
        session: {
          id: session.id,
          title: session.title,
          status: session.status,
          startedAt: session.startedAt,
        },
        currentItem,
        hasFeaturedBefore,
        // Recent chat history (capped Redis list, last 50) so a viewer joining or reloading mid-stream
        // sees what's already been said instead of an empty panel. The live chat.message events then
        // append from here. Read through ChatService, not the chat infra cache directly.
        recentMessages,
        serverNow: new Date().toISOString(),
      },
    };
  }

  // founder_requests.md §3: a viewer joining after a sale is already open used to see nothing
  // until the next bid ticked sale.updated — this is what actually closes that gap. Null, not an
  // error, when nothing's featured yet (the seller hasn't put anything up, or the stream just
  // started).
  private async resolveCurrentItem(sessionId: string): Promise<unknown> {
    const item = await this.streaming.getActiveQueueItem(sessionId);
    if (!item || !item.saleId) {
      return null;
    }
    const saleResult = await this.sales.getSale({ saleId: item.saleId });
    if (!saleResult.ok) {
      return null;
    }
    const sale = saleResult.value;
    return {
      itemId: item.id,
      productId: item.productId,
      saleId: sale.id,
      mode: sale.mode,
      currentAmount: sale.currentAmount !== null ? Number(sale.currentAmount) : null,
      price: sale.price !== null ? Number(sale.price) : null,
      endsAt: sale.endsAt?.toISOString() ?? null,
    };
  }

  // Whether this session has ever featured anything yet — lets a viewer who joins mid-stream,
  // between items, tell "nothing's gone up for sale yet" apart from "something already sold,
  // waiting on the next one" (23 Oct 2026, founder feedback referencing Whatnot's own distinct
  // empty-state copy for each). Deliberately a plain yes/no, not itemsSold or any other sales
  // figure — stream-session.view.ts's own header comment keeps real sales data private from
  // viewers; this carries none of that, just whether the queue has moved past its starting line.
  private async hasEverFeatured(sessionId: string): Promise<boolean> {
    const items = await this.streaming.listQueueItems({ sessionId });
    return items.some((item) => item.status !== 'PENDING');
  }

  @UseGuards(WsAuthGuard, WsDefaultRateLimitGuard)
  @SubscribeMessage('room.leave')
  async onRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodValidationPipe(RoomLeaveSchema)) dto: RoomLeaveDto,
  ): Promise<void> {
    await client.leave(roomName(dto.sessionId));

    const { userId } = client.data as AuthenticatedSocketData;
    const result = await this.streaming.removeViewer(dto.sessionId, userId);
    this.maybeBroadcastViewerCount(dto.sessionId, result);
  }

  @UseGuards(WsAuthGuard, WsDefaultRateLimitGuard)
  @SubscribeMessage('heartbeat')
  async onHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodValidationPipe(HeartbeatSchema)) dto: HeartbeatDto,
  ): Promise<void> {
    const { userId } = client.data as AuthenticatedSocketData;
    await this.recordPresenceAndMaybeBroadcast(dto.sessionId, userId);
  }

  private async recordPresenceAndMaybeBroadcast(sessionId: string, userId: string): Promise<void> {
    const result = await this.streaming.recordHeartbeat(sessionId, userId);
    this.maybeBroadcastViewerCount(sessionId, result);
  }

  private maybeBroadcastViewerCount(
    sessionId: string,
    result: { count: number; shouldBroadcast: boolean },
  ): void {
    if (!result.shouldBroadcast) {
      return;
    }
    // This instance won PresenceService's Redis throttle lock for this tick — its local emit is
    // what the redis-adapter fans out to every other realtime instance's clients in the room
    // (proved live in P4-04), so exactly one broadcast reaches the room even with N instances.
    this.server?.to(roomName(sessionId)).emit('viewers.count', { count: result.count });
  }
}
