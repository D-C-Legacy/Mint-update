import { ApplicationDecision, Seller, SellerType } from '../entities/seller.entity';
import { SellerApplicationDetail, SellerApplicationSummary } from '../entities/seller-application-summary.entity';

export const SELLER_REPOSITORY = Symbol('SellerRepositoryPort');

export interface CreateDraftInput {
  readonly id: string;
  readonly userId: string;
  readonly type: SellerType;
  readonly legalName: string;
  readonly displayName: string;
  readonly applicationId: string;
  readonly formData: Record<string, unknown>;
}

export interface UpdateDraftInput {
  readonly type: SellerType;
  readonly legalName: string;
  readonly displayName: string;
  readonly formData: Record<string, unknown>;
}

export interface UpdateProfileInput {
  readonly displayName: string;
}

export interface UpdateCommissionInput {
  readonly commissionBps: number;
}

export interface ListApplicationsFilter {
  readonly decision: ApplicationDecision | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface SellerRepositoryPort {
  findByUserId(userId: string): Promise<Seller | null>;
  findById(id: string): Promise<Seller | null>;
  findByApplicationId(applicationId: string): Promise<Seller | null>;
  createDraft(input: CreateDraftInput): Promise<Seller>;
  updateDraft(sellerId: string, input: UpdateDraftInput): Promise<Seller>;
  updateProfile(sellerId: string, input: UpdateProfileInput): Promise<Seller>;
  /** Added for P8-06's `PATCH /admin/sellers/:id/commission` (05-API-SPEC.md §11) — unowned by
   *  any ticket since P2-06 flagged it. No doc gives a valid range; 0-10000 bps (0%-100%) is
   *  enforced at the Zod DTO boundary, matching P7-04's confirmed-legitimate 0/10000 edge cases. */
  updateCommission(sellerId: string, input: UpdateCommissionInput): Promise<Seller>;
  submit(sellerId: string, submittedAt: Date): Promise<Seller>;
  withdraw(sellerId: string): Promise<Seller>;
  approve(sellerId: string, reviewedByUserId: string, approvedAt: Date): Promise<Seller>;
  reject(sellerId: string, reviewedByUserId: string, reviewedAt: Date, reason: string): Promise<Seller>;
  suspend(sellerId: string, suspendedAt: Date): Promise<Seller>;
  reinstate(sellerId: string): Promise<Seller>;
  listApplications(filter: ListApplicationsFilter): Promise<SellerApplicationSummary[]>;
  getApplicationDetail(applicationId: string): Promise<SellerApplicationDetail | null>;
}
