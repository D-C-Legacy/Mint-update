export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'EXPIRED' | 'WITHDRAWN';

export interface Offer {
  readonly id: string;
  readonly saleId: string;
  readonly userId: string;
  readonly amount: bigint;
  readonly status: OfferStatus;
  readonly counterAmount: bigint | null;
  readonly respondedAt: Date | null;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}
