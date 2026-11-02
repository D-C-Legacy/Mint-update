import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { stripeConfig } from '../../../../config/stripe.config';
import { PAYMENT_PROVIDER, PaymentProviderPort, SavedPaymentMethod } from '../../domain/ports/payment-provider.port';
import { PaymentMethodNotFoundError } from '../../domain/errors/payments.errors';
import { ProviderCustomerResolver } from '../provider-customer.resolver';

export interface SetupIntentResult {
  readonly clientSecret: string;
  // Public by design: the browser needs it to talk to Stripe directly. Card numbers go from the
  // browser to Stripe and never pass through this server.
  readonly publishableKey: string;
}

// `POST /payments/setup-intent` (05-API-SPEC.md §9). Returns what the client needs to collect a
// card with Stripe's own form and attach it to this user's customer.
@Injectable()
export class CreateSetupIntentUseCase {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProviderPort,
    private readonly customers: ProviderCustomerResolver,
  ) {}

  async execute(cmd: { userId: string }): Promise<SetupIntentResult> {
    const customerId = await this.customers.getOrCreate(cmd.userId);
    const setup = await this.provider.createSetupIntent(customerId);
    return { clientSecret: setup.clientSecret, publishableKey: stripeConfig.publishableKey };
  }
}

// `GET /payments/methods`. Cards are read from Stripe, not copied here, so a card added or removed
// elsewhere is always reflected. A user with no customer yet simply has none.
@Injectable()
export class ListPaymentMethodsUseCase {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProviderPort,
    private readonly customers: ProviderCustomerResolver,
  ) {}

  async execute(cmd: { userId: string }): Promise<SavedPaymentMethod[]> {
    const customerId = await this.customers.find(cmd.userId);
    return customerId ? this.provider.listPaymentMethods(customerId) : [];
  }
}

// `DELETE /payments/methods/:id`. The id must be one of the caller's own saved cards.
@Injectable()
export class RemovePaymentMethodUseCase {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProviderPort,
    private readonly customers: ProviderCustomerResolver,
  ) {}

  async execute(cmd: {
    userId: string;
    paymentMethodId: string;
  }): Promise<Result<{ removed: true }, PaymentMethodNotFoundError>> {
    const customerId = await this.customers.find(cmd.userId);
    const mine = customerId ? await this.provider.listPaymentMethods(customerId) : [];
    if (!mine.some((m) => m.providerPaymentMethodId === cmd.paymentMethodId)) {
      return Err(new PaymentMethodNotFoundError(cmd.paymentMethodId));
    }
    await this.provider.detachPaymentMethod(cmd.paymentMethodId);
    return Ok({ removed: true });
  }
}
