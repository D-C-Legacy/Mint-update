import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SalesService } from '../../application/sales.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { OptionalJwtGuard } from '../../../../platform/auth/optional-jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { CreateSaleSchema, CreateSaleDto } from './dto/create-sale.dto';
import { SwitchSaleModeSchema, SwitchSaleModeDto } from './dto/switch-sale-mode.dto';
import { PlaceBidSchema, PlaceBidDto } from './dto/place-bid.dto';
import { BuyNowSchema, BuyNowDto } from './dto/buy-now.dto';
import { SubmitOfferSchema, SubmitOfferDto } from './dto/submit-offer.dto';
import { RespondToOfferSchema, RespondToOfferDto } from './dto/respond-to-offer.dto';
import { ListBidsQuerySchema, ListBidsQueryDto } from './dto/list-bids-query.dto';
import {
  ListPublicSalesQuerySchema,
  ListPublicSalesQueryDto,
  ListMyBidsQuerySchema,
  ListMyBidsQueryDto,
} from './dto/list-public-sales-query.dto';
import {
  ListSellerOffersQuerySchema,
  ListSellerOffersQueryDto,
} from './dto/list-seller-offers-query.dto';
import {
  toPublicSaleView,
  toSaleDetailView,
  toMyBidView,
  toSellerOfferView,
} from './public-sale.view';

// HTTP fallbacks for the WS-first paths (bid.place/buy.now/offer.submit — see sales.gateway.ts)
// per 05-API-SPEC.md §7: "Most sale actions happen over WebSocket for latency. HTTP equivalents
// exist for reliability and for the admin panel." Both paths call the exact same SalesService
// methods, so behavior is identical regardless of transport.
//
// `Idempotency-Key` (05-API-SPEC.md §1: required on every money-mutating POST) is NOT enforced
// here — that's explicitly P9-02's own deliverable ("Idempotency-Key guard + IdempotencyRecord
// store, applied to all money endpoints"), not built early. `clientRef` in the body is a
// client-generated echo id for matching an optimistic UI update, not a server-side dedupe key.
@Controller()
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post('sales')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async createSale(
    @Body(new ZodValidationPipe(CreateSaleSchema)) dto: CreateSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.sales.createSale(
      dto.mode === 'AUCTION'
        ? {
            sellerUserId: user.id,
            sessionId: dto.sessionId,
            productId: dto.productId,
            mode: dto.mode,
            currency: dto.currency,
            startAmount: dto.startAmount,
            ...(dto.durationSeconds !== undefined ? { durationSeconds: dto.durationSeconds } : {}),
          }
        : { ...dto, sellerUserId: user.id },
    );
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  // Phase 9 hardening: this previously returned the raw domain Sale, leaking `winnerUserId` (an
  // internal user id) and `orderId`/`version` to anyone — flagged since Phase 5. `orderId`/
  // `version` are dropped entirely (never read by the app); `winnerUserId` is still genuinely
  // needed by the product page to show "You won this one" to the actual winner, so auth is
  // "optional" here per 05-API-SPEC.md §7 and toSaleDetailView() only reveals it to that one
  // caller — everyone else, signed in or not, gets `null`, same as before the sale resolved.
  @Get('sales/:id')
  @UseGuards(OptionalJwtGuard)
  async getSale(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user?: AuthenticatedUser },
  ): Promise<{ data: unknown }> {
    const result = await this.sales.getSale({ saleId: id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toSaleDetailView(result.value, req.user?.id ?? null) };
  }

  @Post('sales/:id/cancel')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async cancelSale(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.sales.cancelSale({ saleId: id, sellerUserId: user.id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  // Not in 05-API-SPEC.md — new with the live-streaming build-out (founder_requests.md §1, decided
  // 14 Oct 2026: switching keeps the same sale/bids, doesn't start a new one).
  @Post('sales/:id/mode')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async switchSaleMode(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SwitchSaleModeSchema)) dto: SwitchSaleModeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.sales.switchSaleMode(
      dto.mode === 'AUCTION'
        ? {
            saleId: id,
            sellerUserId: user.id,
            mode: dto.mode,
            startAmount: dto.startAmount,
            ...(dto.durationSeconds !== undefined ? { durationSeconds: dto.durationSeconds } : {}),
          }
        : dto.mode === 'BUY_NOW'
          ? { saleId: id, sellerUserId: user.id, ...dto }
          : { saleId: id, sellerUserId: user.id, mode: dto.mode },
    );
    if (!result.ok) throw toHttpException(result.error);
    return { data: { saleId: result.value.sale.id, mode: result.value.sale.mode } };
  }

  // No DefaultRateLimitGuard here (or on submitOffer/respondToOffer below) — their own, more
  // specific 05-API-SPEC.md §13 scope (bid: 5/sec, offer: 2/sec) is checked once inside the
  // shared use case, so it already covers this HTTP route and sales.gateway.ts's WS equivalent
  // identically; adding the 100/min default on top would just be a second, redundant bucket.
  @Post('sales/:id/bids')
  @UseGuards(JwtGuard)
  async placeBid(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PlaceBidSchema)) dto: PlaceBidDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.sales.placeBid({
      saleId: id,
      bidderUserId: user.id,
      amount: dto.amount,
      clientRef: dto.clientRef,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('sales/:id/buy')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async buyNow(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(BuyNowSchema)) dto: BuyNowDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.sales.buyNow({
      saleId: id,
      buyerUserId: user.id,
      clientRef: dto.clientRef,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('sales/:id/offers')
  @UseGuards(JwtGuard)
  async submitOffer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SubmitOfferSchema)) dto: SubmitOfferDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.sales.submitOffer({
      saleId: id,
      buyerUserId: user.id,
      amount: dto.amount,
      clientRef: dto.clientRef,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('offers/:id/respond')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  async respondToOffer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RespondToOfferSchema)) dto: RespondToOfferDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.sales.respondToOffer(
      dto.action === 'COUNTER'
        ? {
            offerId: id,
            respondingUserId: user.id,
            action: 'COUNTER',
            counterAmount: dto.counterAmount,
          }
        : { offerId: id, respondingUserId: user.id, action: dto.action },
    );
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Get('sales/:id/bids')
  async listBids(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(ListBidsQuerySchema)) query: ListBidsQueryDto,
  ): Promise<{ data: unknown }> {
    const page = await this.sales.listBids({
      saleId: id,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: page };
  }

  // Public directory of sales (05-API-SPEC.md §7). Defaults to OPEN. No guard, like GET /categories.
  @Get('sales')
  async listSales(
    @Query(new ZodValidationPipe(ListPublicSalesQuerySchema)) query: ListPublicSalesQueryDto,
  ): Promise<{ data: unknown }> {
    const page = await this.sales.listPublicSales({
      mode: query.mode,
      productId: query.productId,
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: { items: page.items.map(toPublicSaleView), nextCursor: page.nextCursor } };
  }

  // The signed-in buyer's own bids across every sale.
  @Get('me/bids')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async listMyBids(
    @Query(new ZodValidationPipe(ListMyBidsQuerySchema)) query: ListMyBidsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const page = await this.sales.listMyBids({
      userId: user.id,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: { items: page.items.map(toMyBidView), nextCursor: page.nextCursor } };
  }

  // The seller's offer inbox (Phase 2 of the offers arc, not in 05-API-SPEC.md — seller-facing
  // counterpart of POST /offers/:id/respond). Default when no `status` param is passed is
  // PENDING, the actionable view that needs a response (user decision 17 Oct 2026); history
  // needs an explicit comma-separated status list, e.g. status=ACCEPTED,COUNTERED.
  @Get('seller/offers')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async listSellerOffers(
    @Query(new ZodValidationPipe(ListSellerOffersQuerySchema)) query: ListSellerOffersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const page = await this.sales.listSellerOffers({
      sellerUserId: user.id,
      statuses: query.status ?? ['PENDING'],
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: { items: page.items.map(toSellerOfferView), nextCursor: page.nextCursor } };
  }
}
