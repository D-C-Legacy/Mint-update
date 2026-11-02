export type SaleMode = 'AUCTION' | 'BUY_NOW' | 'OFFER';
export type SaleStatus = 'OPEN' | 'CLOSING' | 'RESOLVED' | 'CANCELLED' | 'EXPIRED';

export interface Sale {
  readonly id: string;
  readonly sessionId: string;
  readonly sellerId: string;
  readonly productId: string;
  readonly mode: SaleMode;
  readonly status: SaleStatus;
  readonly currency: string;

  readonly startAmount: bigint | null;
  readonly currentAmount: bigint | null;
  readonly currentBidId: string | null;
  readonly endsAt: Date | null;
  readonly extensionCount: number;

  readonly price: bigint | null;
  readonly quantity: number;

  readonly winnerUserId: string | null;
  readonly finalAmount: bigint | null;
  readonly resolvedAt: Date | null;
  readonly orderId: string | null;

  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
