export type BidStatus = 'ACCEPTED' | 'OUTBID' | 'WINNING' | 'REJECTED';

export interface Bid {
  readonly id: string;
  readonly saleId: string;
  readonly userId: string;
  readonly amount: bigint;
  readonly status: BidStatus;
  readonly sequence: number;
  readonly createdAt: Date;
}
