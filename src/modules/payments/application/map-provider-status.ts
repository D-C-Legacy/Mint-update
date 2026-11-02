import { ProviderPaymentStatus } from '../domain/ports/payment-provider.port';
import { PaymentStatus } from '../domain/entities/payment.entity';

// `ProviderPaymentStatus` (6 values, generic across any future provider) -> this schema's own
// `Payment.status` enum (7 values, no REQUIRES_CAPTURE — PayOrderUseCase always calls capture
// immediately after a successful confirm, so a Payment row should never actually rest at
// REQUIRES_CAPTURE; mapped to PROCESSING defensively in case that invariant is ever broken).
// REFUNDED/PARTIALLY_REFUNDED are never produced here — only RefundPaymentUseCase sets those.
export function mapProviderStatusToPaymentStatus(status: ProviderPaymentStatus): PaymentStatus {
  switch (status) {
    case 'REQUIRES_PAYMENT':
      return 'REQUIRES_PAYMENT';
    case 'REQUIRES_CAPTURE':
      return 'PROCESSING';
    case 'PROCESSING':
      return 'PROCESSING';
    case 'SUCCEEDED':
      return 'SUCCEEDED';
    case 'FAILED':
      return 'FAILED';
    case 'CANCELLED':
      return 'CANCELLED';
  }
}
