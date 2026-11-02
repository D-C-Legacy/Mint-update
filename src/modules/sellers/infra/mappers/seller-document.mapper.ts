import type { SellerDocument as PrismaSellerDocument } from '@prisma/client';
import { SellerDocument } from '../../domain/entities/seller-document.entity';

export function toDomainSellerDocument(row: PrismaSellerDocument): SellerDocument {
  return {
    id: row.id,
    applicationId: row.applicationId,
    type: row.type,
    storageKey: row.storageKey,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt,
    reviewNote: row.reviewNote,
  };
}
