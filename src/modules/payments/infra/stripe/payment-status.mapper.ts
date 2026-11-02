import type Stripe from 'stripe';
import { ProviderPaymentStatus } from '../../domain/ports/payment-provider.port';

// Pure Stripe-shape mapping, deliberately kept out of `payment-provider.stripe.adapter.ts` so it
// can be unit-tested without that file's module-scope `stripeConfig` import triggering env
// validation (see this file's `.spec.ts` and MEMORY.md for why that matters in this sandbox).
export function toProviderStatus(intent: Stripe.PaymentIntent): ProviderPaymentStatus {
  // A failed confirm/capture attempt leaves `last_payment_error` populated alongside a status
  // that can still read `requires_payment_method` — from this domain's perspective that attempt
  // failed, regardless of which status string Stripe used to represent "try again".
  if (intent.last_payment_error) {
    return 'FAILED';
  }
  switch (intent.status) {
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
      return 'REQUIRES_PAYMENT';
    case 'requires_capture':
      return 'REQUIRES_CAPTURE';
    case 'processing':
      return 'PROCESSING';
    case 'succeeded':
      return 'SUCCEEDED';
    case 'canceled':
      return 'CANCELLED';
    default:
      return 'REQUIRES_PAYMENT';
  }
}

export function toRefundStatus(status: string | null): 'PENDING' | 'SUCCEEDED' | 'FAILED' {
  switch (status) {
    case 'succeeded':
      return 'SUCCEEDED';
    case 'failed':
    case 'canceled':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}
