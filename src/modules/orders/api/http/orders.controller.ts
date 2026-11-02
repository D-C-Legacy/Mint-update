import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from '../../application/orders.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { ListMyOrdersQuerySchema, ListMyOrdersQueryDto } from './dto/list-my-orders-query.dto';
import {
  ListSellerOrdersQuerySchema,
  ListSellerOrdersQueryDto,
} from './dto/list-seller-orders-query.dto';
import {
  AnalyticsRangeQuerySchema,
  AnalyticsRangeQueryDto,
} from '../../../../shared/analytics/analytics-range-query.dto';
import { SetShippingAddressSchema, SetShippingAddressDto } from './dto/set-shipping-address.dto';
import { ShipOrderSchema, ShipOrderDto } from './dto/ship-order.dto';
import { CancelOrderSchema, CancelOrderDto } from './dto/cancel-order.dto';
import { toOrderView } from './order.view';

// Buyer and seller routes for orders (05-API-SPEC.md §8). Business rules live in the use cases;
// this file only maps request to command and result to HTTP.
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('orders')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async listMine(
    @Query(new ZodValidationPipe(ListMyOrdersQuerySchema)) query: ListMyOrdersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const page = await this.orders.listMyOrders({
      userId: user.id,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: { items: page.items.map(toOrderView), nextCursor: page.nextCursor } };
  }

  @Get('orders/:id')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async getOne(
    @Param('id') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.orders.getMyOrder({ userId: user.id, orderId });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toOrderView(result.value) };
  }

  @Get('seller/orders')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async listSellerQueue(
    @Query(new ZodValidationPipe(ListSellerOrdersQuerySchema)) query: ListSellerOrdersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const page = await this.orders.listSellerOrders({
      sellerUserId: user.id,
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: { items: page.items.map(toOrderView), nextCursor: page.nextCursor } };
  }

  // Seller-scoped mirror of GET /admin/analytics/orders-summary (05-API-SPEC.md doesn't document
  // either — new surface, same undocumented-until-now shape as the admin routes it mirrors).
  @Get('seller/analytics/orders-summary')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async getSellerOrdersSummary(
    @Query(new ZodValidationPipe(AnalyticsRangeQuerySchema)) query: AnalyticsRangeQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.orders.getSellerOrdersSummary({
      sellerUserId: user.id,
      from: query.from,
      to: query.to,
    });
    return { data: result };
  }

  @Get('seller/analytics/orders-by-status')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async getSellerOrdersByStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.orders.getSellerOrdersByStatus({ sellerUserId: user.id });
    return { data: result };
  }

  @Post('orders/:id/address')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async setAddress(
    @Param('id') orderId: string,
    @Body(new ZodValidationPipe(SetShippingAddressSchema)) dto: SetShippingAddressDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.orders.setShippingAddress({
      orderId,
      buyerUserId: user.id,
      address: { ...dto },
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toOrderView(result.value) };
  }

  @Post('orders/:id/ship')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async ship(
    @Param('id') orderId: string,
    @Body(new ZodValidationPipe(ShipOrderSchema)) dto: ShipOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.orders.ship({
      orderId,
      sellerUserId: user.id,
      carrier: dto.carrier,
      trackingNumber: dto.trackingNumber,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toOrderView(result.value) };
  }

  @Post('orders/:id/confirm-delivery')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async confirmDelivery(
    @Param('id') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.orders.confirmDelivery({
      orderId,
      source: 'BUYER',
      buyerUserId: user.id,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toOrderView(result.value) };
  }

  // One route, three callers (05-API-SPEC.md §8 documents the seller/admin version; the buyer
  // branch is a narrower carve-out layered on top, see cancel-order.usecase.ts's header comment).
  // Dispatch is by the caller's own role, same "resolve who's calling, branch in the use-case
  // layer" pattern as everywhere else in this module — no route-level @Roles() restriction fits
  // a single endpoint serving all three roles. Seller/admin covers PENDING_PAYMENT and PAID (the
  // PAID case triggers a refund + ledger reversal via order.cancelled's subscribers, see
  // cancel-order-as-seller-or-admin.usecase.ts).
  @Post('orders/:id/cancel')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async cancel(
    @Param('id') orderId: string,
    @Body(new ZodValidationPipe(CancelOrderSchema)) dto: CancelOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const reason = dto.reason ?? null;
    const result =
      user.role === 'ADMIN'
        ? await this.orders.cancelAsSellerOrAdmin({
            orderId,
            actor: { role: 'ADMIN', userId: user.id },
            reason,
          })
        : user.role === 'SELLER'
          ? await this.orders.cancelAsSellerOrAdmin({
              orderId,
              actor: { role: 'SELLER', userId: user.id },
              reason,
            })
          : await this.orders.cancel({ orderId, buyerUserId: user.id, reason });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toOrderView(result.value) };
  }
}
