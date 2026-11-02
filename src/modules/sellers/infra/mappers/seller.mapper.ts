import type { Seller as PrismaSeller, SellerApplication as PrismaSellerApplication } from '@prisma/client';
import { Seller } from '../../domain/entities/seller.entity';

type SellerRow = PrismaSeller & { application: PrismaSellerApplication | null };

export function toDomainSeller(row: SellerRow): Seller {
  if (row.application === null) {
    throw new Error(`Seller ${row.id} is missing its application row (create/update always write both together)`);
  }

  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    legalName: row.legalName,
    displayName: row.displayName,
    status: row.status,
    commissionBps: row.commissionBps,
    payoutHoldDays: row.payoutHoldDays,
    application: {
      id: row.application.id,
      sellerId: row.application.sellerId,
      submittedAt: row.application.submittedAt,
      reviewedAt: row.application.reviewedAt,
      reviewedByUserId: row.application.reviewedByUserId,
      decision: row.application.decision,
      rejectionReason: row.application.rejectionReason,
      formData: row.application.formData as Record<string, unknown>,
    },
  };
}
