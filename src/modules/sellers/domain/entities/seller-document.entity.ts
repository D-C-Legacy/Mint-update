export type DocumentType =
  | 'GOVERNMENT_ID'
  | 'PROOF_OF_ADDRESS'
  | 'BUSINESS_REGISTRATION'
  | 'TAX_DOCUMENT'
  | 'OTHER';

export interface SellerDocument {
  readonly id: string;
  readonly applicationId: string;
  readonly type: DocumentType;
  readonly storageKey: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly uploadedAt: Date;
  readonly reviewNote: string | null;
}
