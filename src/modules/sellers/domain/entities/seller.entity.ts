export type SellerType = 'INDIVIDUAL' | 'BUSINESS';
export type SellerStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type ApplicationDecision = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SellerApplication {
  readonly id: string;
  readonly sellerId: string;
  readonly submittedAt: Date | null;
  readonly reviewedAt: Date | null;
  readonly reviewedByUserId: string | null;
  readonly decision: ApplicationDecision;
  readonly rejectionReason: string | null;
  readonly formData: Record<string, unknown>;
}

export interface Seller {
  readonly id: string;
  readonly userId: string;
  readonly type: SellerType;
  readonly legalName: string;
  readonly displayName: string;
  readonly status: SellerStatus;
  readonly commissionBps: number;
  readonly payoutHoldDays: number;
  readonly application: SellerApplication;
}
