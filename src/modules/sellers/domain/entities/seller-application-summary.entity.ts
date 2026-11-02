import { ApplicationDecision, SellerStatus, SellerType } from './seller.entity';
import { DocumentType } from './seller-document.entity';

export interface SellerApplicationSummary {
  readonly applicationId: string;
  readonly sellerId: string;
  readonly type: SellerType;
  readonly legalName: string;
  readonly displayName: string;
  readonly status: SellerStatus;
  readonly decision: ApplicationDecision;
  readonly submittedAt: Date | null;
  readonly reviewedAt: Date | null;
}

export interface SellerApplicationDocumentSummary {
  readonly id: string;
  readonly type: DocumentType;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly uploadedAt: Date;
  readonly reviewNote: string | null;
}

export interface SellerApplicationDetail extends SellerApplicationSummary {
  readonly formData: Record<string, unknown>;
  readonly rejectionReason: string | null;
  readonly reviewedByUserId: string | null;
  readonly documents: readonly SellerApplicationDocumentSummary[];
}
