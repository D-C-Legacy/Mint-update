export const PAYMENT_CUSTOMER_REPOSITORY = Symbol('PaymentCustomerRepositoryPort');

export interface PaymentCustomerRepositoryPort {
  findProviderCustomerId(userId: string): Promise<string | null>;
  /** Two first-time requests can race; the loser's insert is dropped and the WINNING id is
   *  returned, so every caller ends up using the same customer. */
  save(userId: string, providerCustomerId: string): Promise<string>;
}
