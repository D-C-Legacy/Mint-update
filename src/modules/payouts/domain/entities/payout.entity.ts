import { PayoutItem } from './payout-item.entity';

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'REVERSED' | 'HELD';

export interface Payout {
  readonly id: string;
  readonly runId: string;
  readonly sellerId: string;
  readonly amount: bigint;
  readonly currency: string;
  readonly status: PayoutStatus;
  readonly idempotencyKey: string;
  readonly providerTransferId: string | null;
  readonly failureReason: string | null;
  readonly sentAt: Date | null;
  readonly createdAt: Date;
  readonly items: readonly PayoutItem[];
}
