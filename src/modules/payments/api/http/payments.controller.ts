import { Body, Controller, Headers, HttpCode, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { PaymentsService } from '../../application/payments.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { IdempotencyGuard } from '../../../../platform/idempotency/idempotency.interceptor';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { PayOrderSchema, PayOrderDto } from './dto/pay-order.dto';

// 05-API-SPEC.md §9: `POST /orders/:id/pay` — "buyer" auth level, Idempotency-Key required.
// Lives in modules/payments (not modules/orders/api/http) even though the URL is orders-prefixed
// — the spec's own §9 groups this route under "payments" alongside setup-intent/methods/webhook,
// and PaymentsModule already imports OrdersModule (for OrdersService.markPaid/markRefunded), so
// putting the controller in modules/orders instead would need OrdersModule to import
// PaymentsModule back — a circular module dependency. Flagged gap closed per explicit user
// decision this session (P9-02): no ticket in the 65 ever built modules/payments/api/http/** or
// modules/orders/api/http/**, carried in MEMORY.md since P6-01/P6-06/P6-07 — this is the first
// route either gets, built now so P9-02's flagship documented example (the one route the API spec
// explicitly names for Idempotency-Key) is actually reachable and demonstrable end-to-end.
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('orders/:id/pay')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  @UseInterceptors(IdempotencyGuard)
  async payOrder(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PayOrderSchema)) dto: PayOrderDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.payments.payOrder({
      orderId: id,
      buyerUserId: user.id,
      idempotencyKey,
      ...(dto.paymentMethodId !== undefined ? { paymentMethodId: dto.paymentMethodId } : {}),
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }
}
