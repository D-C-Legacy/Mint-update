export type PaymentStatus =
  | 'REQUIRES_PAYMENT'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface Payment {
  readonly id: string;
  readonly orderId: string;
  readonly provider: string;
  readonly providerIntentId: string;
  readonly providerChargeId: string | null;
  readonly status: PaymentStatus;
  readonly amount: bigint;
  readonly currency: string;
  readonly providerFee: bigint | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly capturedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
