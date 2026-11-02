import { Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from '../../application/payments.service';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { toHttpException } from '../../../../shared/errors/to-http-exception';

// 05-API-SPEC.md §9: saved cards. Cards live in Stripe; this server only maps the user to a Stripe
// customer. Card numbers never reach it: the client collects them with Stripe's own form using the
// client secret from `POST /payments/setup-intent`.
@Controller('payments')
@UseGuards(JwtGuard, DefaultRateLimitGuard)
export class PaymentMethodsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('setup-intent')
  @HttpCode(200)
  async setupIntent(@CurrentUser() user: AuthenticatedUser): Promise<{ data: unknown }> {
    return { data: await this.payments.createSetupIntent({ userId: user.id }) };
  }

  @Get('methods')
  async list(@CurrentUser() user: AuthenticatedUser): Promise<{ data: unknown }> {
    const methods = await this.payments.listPaymentMethods({ userId: user.id });
    return {
      data: {
        items: methods.map((m) => ({
          id: m.providerPaymentMethodId,
          brand: m.brand,
          last4: m.last4,
          expiryMonth: m.expiryMonth,
          expiryYear: m.expiryYear,
        })),
      },
    };
  }

  @Delete('methods/:id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<{ data: unknown }> {
    const result = await this.payments.removePaymentMethod({ userId: user.id, paymentMethodId: id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }
}
