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
import { WsDefaultRateLimitGuard } from '../../../../platform/rate-limit/ws-default-rate-limit.guard';
import { WsObservabilityInterceptor } from '../../../../platform/observability/ws-observability.interceptor';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { toWsException } from '../../../../shared/errors/to-ws-exception';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import type { DomainEventHandler } from '../../../../shared/events/event-bus.port';
import { SalesService } from '../../application/sales.service';
import { SellersService } from '../../../sellers/application/sellers.service';
import { IdentityService } from '../../../identity/application/identity.service';
import { BID_ACCEPTED_EVENT, BidAcceptedPayload } from '../../events/published/bid-accepted.event';
import {
  SALE_RESOLVED_EVENT,
  SaleResolvedPayload,
} from '../../events/published/sale-resolved.event';
import {
  SALE_CANCELLED_EVENT,
  SaleCancelledPayload,
} from '../../events/published/sale-cancelled.event';
import {
  OFFER_SUBMITTED_EVENT,
  OfferSubmittedPayload,
} from '../../events/published/offer-submitted.event';
import {
  SALE_MODE_SWITCHED_EVENT,
  SaleModeSwitchedPayload,
} from '../../events/published/sale-mode-switched.event';
import {
  OFFER_RESPONDED_EVENT,
  OfferRespondedPayload,
} from '../../events/published/offer-responded.event';
import { BidPlaceSchema, BidPlaceDto } from './dto/bid-place.dto';
import { BuyNowSchema, BuyNowDto } from './dto/buy-now.dto';
import { OfferSubmitSchema, OfferSubmitDto } from './dto/offer-submit.dto';

function roomName(sessionId: string): string {
  return `room:${sessionId}`;
}

function userChannel(userId: string): string {
  return `user:${userId}`;
}

// 06-REALTIME-AND-CONCURRENCY.md §2's inbound bid.place/buy.now/offer.submit, and every
// outbound event this doc names for sales. Third gateway attached to the one shared Socket.IO
// server (alongside StreamingGateway and ChatGateway, same no-second-adapter note since P4-04).
//
// Subscribes to the five domain events published across P5-06/07/08 and translates each into
// its documented WS shape/scope here — the use cases themselves have no socket access, same
// split ChatGateway established for chat.message-deleted. `sale.updated`/`sale.extended`/
// `sale.resolved`/`sale.cancelled` go to the room; `bid.accepted`/`bid.outbid`/`offer.received`/
// `offer.responded` go to one user's personal channel (joined at connect, same as every other
// gateway in this codebase).
//
// `leaderName`/`winnerName` (06-...§2's documented fields) are deliberately NOT resolved here —
// that would need a per-event identity lookup this gateway has no established pattern for yet
// (unlike the Seller.id -> User.id lookup below, which was structurally required just to pick
// the right room). Emitting `leaderUserId`/`winnerUserId` instead; flagged in MEMORY.md as a
// gap for whichever ticket wires real display-name enrichment.
@WebSocketGateway({ cors: { origin: appConfig.corsOrigin } })
@UseInterceptors(WsObservabilityInterceptor)
export class SalesGateway implements OnGatewayInit {
  @WebSocketServer() private server?: Server;

  constructor(
    private readonly sales: SalesService,
    private readonly sellers: SellersService,
    private readonly identity: IdentityService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  // leaderName/winnerName resolution (founder_requests.md §5 needs real usernames, not raw ids —
  // this was a flagged, unresolved gap before this pass, see the class comment above). Falls back
  // to the id itself if the user was somehow deleted between the bid and this lookup, rather than
  // breaking the broadcast over a display nicety. No avatar/profile-picture field exists anywhere
  // in this schema (avatar upload is out of scope, same as seller documents) — frontend renders an
  // initials placeholder, never a fabricated photo.
  private async resolveDisplayName(userId: string): Promise<string> {
    const user = await this.identity.getUserById({ userId });
    return user?.displayName ?? userId;
  }

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
    this.subscribeAcrossProcesses<BidAcceptedPayload>(BID_ACCEPTED_EVENT, async (event) => {
      const p = event.payload;
      const room = roomName(p.sessionId);
      const leaderName = await this.resolveDisplayName(p.bidderUserId);

      this.server?.to(room).emit('sale.updated', {
        saleId: p.saleId,
        currentAmount: Number(p.amount),
        endsAt: p.endsAt,
        bidCount: p.sequence,
        leaderName,
      });

      if (p.extended) {
        this.server?.to(room).emit('sale.extended', {
          saleId: p.saleId,
          endsAt: p.endsAt,
          extensionCount: p.extensionCount,
        });
      }

      this.server?.to(userChannel(p.bidderUserId)).emit('bid.accepted', {
        saleId: p.saleId,
        bidId: p.bidId,
        amount: Number(p.amount),
        clientRef: p.clientRef,
      });

      if (p.previousLeaderUserId) {
        this.server?.to(userChannel(p.previousLeaderUserId)).emit('bid.outbid', {
          saleId: p.saleId,
          newAmount: Number(p.amount),
        });
      }
    });

    this.subscribeAcrossProcesses<SaleResolvedPayload>(SALE_RESOLVED_EVENT, async (event) => {
      const p = event.payload;
      const winnerName = await this.resolveDisplayName(p.winnerUserId);
      this.server?.to(roomName(p.sessionId)).emit('sale.resolved', {
        saleId: p.saleId,
        winnerUserId: p.winnerUserId,
        winnerName,
        finalAmount: Number(p.finalAmount),
      });
    });

    this.subscribeAcrossProcesses<SaleCancelledPayload>(SALE_CANCELLED_EVENT, (event) => {
      const p = event.payload;
      this.server
        ?.to(roomName(p.sessionId))
        .emit('sale.cancelled', { saleId: p.saleId, reason: p.reason });
    });

    // New with the live-streaming build-out (founder_requests.md §1) — not in
    // 06-REALTIME-AND-CONCURRENCY.md's original catalogue, added there alongside this handler.
    this.subscribeAcrossProcesses<SaleModeSwitchedPayload>(SALE_MODE_SWITCHED_EVENT, (event) => {
      const p = event.payload;
      this.server?.to(roomName(p.sessionId)).emit('sale.mode-switched', {
        saleId: p.saleId,
        mode: p.mode,
        currentAmount: p.currentAmount !== null ? Number(p.currentAmount) : null,
        price: p.price !== null ? Number(p.price) : null,
        endsAt: p.endsAt,
      });
    });

    this.subscribeAcrossProcesses<OfferSubmittedPayload>(OFFER_SUBMITTED_EVENT, (event) => {
      const p = event.payload;
      // Seller.id -> User.id: structurally required to pick the right `user:{userId}` room,
      // not an enrichment nicety (see GetSellerByIdQuery, added for exactly this).
      void this.sellers.getSellerById({ sellerId: p.sellerId }).then((seller) => {
        if (!seller) return;
        this.server?.to(userChannel(seller.userId)).emit('offer.received', {
          offer: {
            id: p.offerId,
            saleId: p.saleId,
            userId: p.buyerUserId,
            amount: Number(p.amount),
            expiresAt: p.expiresAt,
          },
        });
      });
    });

    this.subscribeAcrossProcesses<OfferRespondedPayload>(OFFER_RESPONDED_EVENT, (event) => {
      const p = event.payload;
      this.server?.to(userChannel(p.buyerUserId)).emit('offer.responded', {
        offerId: p.offerId,
        status: p.status,
        counterAmount: p.counterAmount !== null ? Number(p.counterAmount) : null,
      });
    });
  }

  // No WsDefaultRateLimitGuard on bid.place/offer.submit — their own more specific scope
  // (05-API-SPEC.md §13: bid 5/sec, offer 2/sec) is checked once inside the shared use case
  // (SalesService.placeBid/submitOffer), already covering this WS path and sales.controller.ts's
  // HTTP equivalent identically. buy.now has no documented scope of its own, so it gets the
  // 100/min default guard below instead.
  @UseGuards(WsAuthGuard)
  @SubscribeMessage('bid.place')
  async onBidPlace(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodValidationPipe(BidPlaceSchema)) dto: BidPlaceDto,
  ): Promise<void> {
    const { userId } = client.data as AuthenticatedSocketData;
    const result = await this.sales.placeBid({
      saleId: dto.saleId,
      bidderUserId: userId,
      amount: dto.amount,
      clientRef: dto.clientRef,
    });
    if (result.ok) {
      return; // success feedback (bid.accepted) arrives via the subscribed event above
    }

    // 06-REALTIME-AND-CONCURRENCY.md §2 documents a bespoke `bid.rejected` shape with extra
    // fields (code, minimumNext) beyond NestJS's generic WsException translation — worth the
    // direct emit here, unlike buy-now/offer-submit below where no bespoke shape is documented.
    client.emit('bid.rejected', {
      saleId: dto.saleId,
      code: result.error.code,
      minimumNext: result.error.details?.['minimumNext'] ?? null,
      clientRef: dto.clientRef,
    });
  }

  @UseGuards(WsAuthGuard, WsDefaultRateLimitGuard)
  @SubscribeMessage('buy.now')
  async onBuyNow(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodValidationPipe(BuyNowSchema)) dto: BuyNowDto,
  ): Promise<void> {
    const { userId } = client.data as AuthenticatedSocketData;
    const result = await this.sales.buyNow({
      saleId: dto.saleId,
      buyerUserId: userId,
      clientRef: dto.clientRef,
    });
    if (!result.ok) {
      throw toWsException(result.error);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('offer.submit')
  async onOfferSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodValidationPipe(OfferSubmitSchema)) dto: OfferSubmitDto,
  ): Promise<void> {
    const { userId } = client.data as AuthenticatedSocketData;
    const result = await this.sales.submitOffer({
      saleId: dto.saleId,
      buyerUserId: userId,
      amount: dto.amount,
      clientRef: dto.clientRef,
    });
    if (!result.ok) {
      throw toWsException(result.error);
    }
  }
}
