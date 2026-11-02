import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { EventsModule } from '../../platform/events/events.module';
import { WebhooksModule } from '../../platform/webhooks/webhooks.module';
import { QueueModule } from '../../platform/queue/queue.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { IdempotencyModule } from '../../platform/idempotency/idempotency.module';
import { OrdersModule } from '../orders/orders.module';
import { IdentityModule } from '../identity/identity.module';
import { PAYMENT_PROVIDER } from './domain/ports/payment-provider.port';
import { PAYMENT_REPOSITORY } from './domain/ports/payment.repository.port';
import { PAYMENT_CUSTOMER_REPOSITORY } from './domain/ports/payment-customer.repository.port';
import { REFUND_REPOSITORY } from './domain/ports/refund.repository.port';
import { StripePaymentProviderAdapter } from './infra/stripe/payment-provider.stripe.adapter';
import { PaymentPrismaRepository } from './infra/repositories/payment.prisma.repository';
import { PaymentCustomerPrismaRepository } from './infra/repositories/payment-customer.prisma.repository';
import { RefundPrismaRepository } from './infra/repositories/refund.prisma.repository';
import { StripeWebhookProcessor } from './infra/jobs/stripe-webhook.processor';
import { StripeWebhookController } from './api/webhooks/stripe-webhook.controller';
import { PaymentsController } from './api/http/payments.controller';
import { PaymentMethodsController } from './api/http/payment-methods.controller';
import { PayOrderUseCase } from './application/commands/pay-order.usecase';
import { RefundPaymentUseCase } from './application/commands/refund-payment.usecase';
import { ApplyProviderEventUseCase } from './application/commands/apply-provider-event.usecase';
import {
  CreateSetupIntentUseCase,
  ListPaymentMethodsUseCase,
  RemovePaymentMethodUseCase,
} from './application/commands/saved-cards.usecases';
import { ProviderCustomerResolver } from './application/provider-customer.resolver';
import { PaymentsService } from './application/payments.service';
import { OnOrderCancelledHandler } from './events/handlers/on-order-cancelled.handler';

// First ticket to wire modules/payments into the DI graph — wired into AppModule now, not
// deferred to a later ticket, same "the worker/handler needs to be live at boot" reasoning as
// every prior module whose first real ticket was a background processor (SalesModule,
// OrdersModule, ChannelsModule's event handler).
@Module({
  imports: [
    DatabaseModule,
    EventsModule,
    WebhooksModule,
    QueueModule,
    AuthModule,
    RateLimitModule,
    IdempotencyModule,
    OrdersModule,
    IdentityModule,
  ],
  controllers: [StripeWebhookController, PaymentsController, PaymentMethodsController],
  providers: [
    { provide: PAYMENT_PROVIDER, useClass: StripePaymentProviderAdapter },
    { provide: PAYMENT_REPOSITORY, useClass: PaymentPrismaRepository },
    { provide: PAYMENT_CUSTOMER_REPOSITORY, useClass: PaymentCustomerPrismaRepository },
    { provide: REFUND_REPOSITORY, useClass: RefundPrismaRepository },
    PayOrderUseCase,
    RefundPaymentUseCase,
    ApplyProviderEventUseCase,
    CreateSetupIntentUseCase,
    ListPaymentMethodsUseCase,
    RemovePaymentMethodUseCase,
    ProviderCustomerResolver,
    PaymentsService,
    StripeWebhookProcessor,
    OnOrderCancelledHandler,
  ],
  exports: [PAYMENT_PROVIDER, PaymentsService],
})
export class PaymentsModule {}
