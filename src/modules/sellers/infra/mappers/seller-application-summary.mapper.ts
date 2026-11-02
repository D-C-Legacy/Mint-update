import type {
  Seller as PrismaSeller,
  SellerApplication as PrismaSellerApplication,
  SellerDocument as PrismaSellerDocument,
} from '@prisma/client';
import {
  SellerApplicationDetail,
  SellerApplicationSummary,
} from '../../domain/entities/seller-application-summary.entity';

type ApplicationWithSeller = PrismaSellerApplication & { seller: PrismaSeller };
type ApplicationWithSellerAndDocuments = ApplicationWithSeller & { documents: PrismaSellerDocument[] };

export function toApplicationSummary(row: ApplicationWithSeller): SellerApplicationSummary {
  return {
    applicationId: row.id,
    sellerId: row.sellerId,
    type: row.seller.type,
    legalName: row.seller.legalName,
    displayName: row.seller.displayName,
    status: row.seller.status,
    decision: row.decision,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
  };
}

export function toApplicationDetail(row: ApplicationWithSellerAndDocuments): SellerApplicationDetail {
  return {
    ...toApplicationSummary(row),
    formData: row.formData as Record<string, unknown>,
    rejectionReason: row.rejectionReason,
    reviewedByUserId: row.reviewedByUserId,
    documents: row.documents.map((doc) => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      uploadedAt: doc.uploadedAt,
      reviewNote: doc.reviewNote,
    })),
  };
}
