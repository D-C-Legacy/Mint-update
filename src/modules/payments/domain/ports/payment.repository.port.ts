import { Payment, PaymentStatus } from '../entities/payment.entity';

export const PAYMENT_REPOSITORY = Symbol('PaymentRepositoryPort');

export interface CreatePaymentInput {
  readonly id: string;
  readonly orderId: string;
  readonly providerIntentId: string;
  readonly amount: bigint;
  readonly currency: string;
}

export interface UpdatePaymentOutcomeInput {
  readonly status: PaymentStatus;
  readonly providerChargeId: string | null;
  readonly providerFee: bigint | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly capturedAt: Date | null;
}

export interface PaymentRepositoryPort {
  findById(id: string): Promise<Payment | null>;
  findByOrderId(orderId: string): Promise<Payment | null>;
  /** Webhooks identify a payment by the processor's own ids, not ours. */
  findByProviderIntentId(providerIntentId: string): Promise<Payment | null>;
  findByProviderChargeId(providerChargeId: string): Promise<Payment | null>;
  /** `Payment.orderId` is `@unique` (03-DATA-MODEL.md §9) — under a genuine concurrent race
   *  (two calls paying the same order at once), the losing insert hits a P2002 violation; this
   *  disambiguates that from any other failure and returns the WINNING row instead of throwing,
   *  same "fetch-and-return-existing" precedent as P3-04's slug collision handling. The caller
   *  (PayOrderUseCase) must always confirm/capture against whichever row this returns, never
   *  assume it's the one it just asked to create. */
  create(input: CreatePaymentInput): Promise<Payment>;
  updateOutcome(id: string, input: UpdatePaymentOutcomeInput): Promise<Payment>;
  markRefundStatus(id: string, status: 'REFUNDED' | 'PARTIALLY_REFUNDED'): Promise<Payment>;
}
