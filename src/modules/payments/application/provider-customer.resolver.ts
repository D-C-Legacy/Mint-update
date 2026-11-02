import { Inject, Injectable } from '@nestjs/common';
import {
  PAYMENT_CUSTOMER_REPOSITORY,
  PaymentCustomerRepositoryPort,
} from '../domain/ports/payment-customer.repository.port';
import { PAYMENT_PROVIDER, PaymentProviderPort } from '../domain/ports/payment-provider.port';
import { IdentityService } from '../../identity/application/identity.service';

// Maps a user to their Stripe customer (saved cards hang off it). The customer is created lazily
// the first time a user saves a card; users who never do never get one.
@Injectable()
export class ProviderCustomerResolver {
  constructor(
    @Inject(PAYMENT_CUSTOMER_REPOSITORY) private readonly customers: PaymentCustomerRepositoryPort,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProviderPort,
    private readonly identity: IdentityService,
  ) {}

  async find(userId: string): Promise<string | null> {
    return this.customers.findProviderCustomerId(userId);
  }

  async getOrCreate(userId: string): Promise<string> {
    const existing = await this.customers.findProviderCustomerId(userId);
    if (existing) return existing;

    const user = await this.identity.getUserById({ userId });
    if (!user) {
      // The caller is authenticated, so a missing user is a data-integrity bug, not a user error.
      throw new Error(`Cannot create a payment customer: user ${userId} does not exist`);
    }
    const created = await this.provider.createCustomer({ userId, email: user.email });
    return this.customers.save(userId, created.providerCustomerId);
  }
}
