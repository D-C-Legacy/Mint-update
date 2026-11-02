import { DocumentType, SellerDocument } from '../entities/seller-document.entity';

export const SELLER_DOCUMENT_REPOSITORY = Symbol('SellerDocumentRepositoryPort');

export interface CreateDocumentInput {
  readonly id: string;
  readonly applicationId: string;
  readonly type: DocumentType;
  readonly storageKey: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface SellerDocumentRepositoryPort {
  create(input: CreateDocumentInput): Promise<SellerDocument>;
  findById(id: string): Promise<SellerDocument | null>;
  listForApplication(applicationId: string): Promise<SellerDocument[]>;
  deleteForApplication(documentId: string, applicationId: string): Promise<boolean>;
}
