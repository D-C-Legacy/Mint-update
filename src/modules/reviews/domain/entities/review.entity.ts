export type ReviewStatus = 'VISIBLE' | 'HIDDEN';

export interface Review {
  readonly id: string;
  readonly orderId: string;
  readonly sellerId: string;
  readonly buyerUserId: string;
  readonly rating: number;
  readonly body: string | null;
  readonly status: ReviewStatus;
  readonly sellerResponseBody: string | null;
  readonly sellerRespondedAt: Date | null;
  readonly hiddenByUserId: string | null;
  readonly hiddenAt: Date | null;
  readonly hiddenReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
