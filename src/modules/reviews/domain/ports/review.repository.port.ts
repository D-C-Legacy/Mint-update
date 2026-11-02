import { Review, ReviewStatus } from '../entities/review.entity';

export const REVIEW_REPOSITORY = Symbol('ReviewRepositoryPort');

export interface CreateReviewInput {
  readonly id: string;
  readonly orderId: string;
  readonly sellerId: string;
  readonly buyerUserId: string;
  readonly rating: number;
  readonly body: string | null;
}

export interface UpdateReviewInput {
  readonly rating: number;
  readonly body: string | null;
}

export interface ListForSellerFilter {
  readonly sellerId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface ListForAdminFilter {
  readonly status: ReviewStatus | undefined;
  readonly sellerId: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface SellerRatingSummary {
  readonly sellerId: string;
  readonly averageRating: number;
  readonly reviewCount: number;
}

export interface ReviewRepositoryPort {
  create(input: CreateReviewInput): Promise<Review>;
  findById(id: string): Promise<Review | null>;
  findByOrderId(orderId: string): Promise<Review | null>;
  update(id: string, input: UpdateReviewInput): Promise<Review | null>;
  delete(id: string, buyerUserId: string): Promise<boolean>;
  respond(id: string, sellerId: string, body: string): Promise<Review | null>;
  setVisibility(id: string, status: ReviewStatus, hiddenByUserId: string | null, reason: string | null): Promise<Review | null>;
  /** Public-facing listing, VISIBLE only. */
  listForSeller(filter: ListForSellerFilter): Promise<Review[]>;
  getRatingSummary(sellerId: string): Promise<SellerRatingSummary>;
  /** Admin moderation queue — every status, optional seller filter. */
  listForAdmin(filter: ListForAdminFilter): Promise<Review[]>;
}
