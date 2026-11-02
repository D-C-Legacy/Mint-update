import { Offer, OfferStatus } from '../entities/offer.entity';

export const OFFER_REPOSITORY = Symbol('OfferRepositoryPort');

export interface CreateOfferInput {
  readonly id: string;
  readonly saleId: string;
  readonly userId: string;
  readonly amount: bigint;
  readonly expiresAt: Date;
}

export interface RespondInput {
  readonly status: OfferStatus;
  readonly counterAmount: bigint | null;
  readonly respondedAt: Date;
}

export interface ListSellerOffersFilter {
  readonly sellerId: string;
  /** All statuses when omitted; the seller offer inbox passes PENDING for the action view and
   *  can fetch responded history separately. */
  readonly statuses?: OfferStatus[];
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface OfferRepositoryPort {
  findById(id: string): Promise<Offer | null>;
  /** Offers on this seller's own sales, most recent first (the seller's offer inbox,
   *  GET /seller/offers — 2b route). Cursor-paginated like BidRepositoryPort.findBySaleId. */
  listBySellerId(filter: ListSellerOffersFilter): Promise<Offer[]>;
  create(input: CreateOfferInput): Promise<Offer>;
  /** Atomic, conditional on current status being PENDING. Null if it no longer was (already
   *  responded to, or expired out from under the caller) — the caller treats that as
   *  OfferExpiredError rather than silently succeeding. */
  respond(id: string, input: RespondInput): Promise<Offer | null>;
  /** `WHERE status = 'PENDING' AND expiresAt < now()`, bulk-transitioned to EXPIRED in one
   *  statement (Prisma's `updateMany` has no `take`/limit, unlike the Sale sweeper's query —
   *  not a documented concern for offers' expected volume). Returns the count updated.
   *  Housekeeping only — respond-to-offer independently checks `expiresAt` itself, so
   *  correctness doesn't depend on this job having run recently. */
  expirePending(): Promise<number>;
}
