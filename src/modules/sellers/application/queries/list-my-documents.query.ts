import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import {
  SELLER_DOCUMENT_REPOSITORY,
  SellerDocumentRepositoryPort,
} from '../../domain/ports/seller-document.repository.port';
import { SellerApplicationNotFoundError } from '../../domain/errors/sellers.errors';
import { SellerApplicationDocumentSummary } from '../../domain/entities/seller-application-summary.entity';

export interface ListMyDocumentsCommand {
  readonly userId: string;
}

// GET /v1/seller/documents — the seller's own uploaded documents, without their storage keys (the
// download URL comes from GET /admin/documents/:id/url for admins; the seller doesn't need the key).
@Injectable()
export class ListMyDocumentsQuery {
  constructor(
    @Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort,
    @Inject(SELLER_DOCUMENT_REPOSITORY) private readonly documents: SellerDocumentRepositoryPort,
  ) {}

  async execute(
    cmd: ListMyDocumentsCommand,
  ): Promise<Result<SellerApplicationDocumentSummary[], SellerApplicationNotFoundError>> {
    const seller = await this.sellers.findByUserId(cmd.userId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`user ${cmd.userId}`));
    }

    const documents = await this.documents.listForApplication(seller.application.id);
    return Ok(
      documents.map((document) => ({
        id: document.id,
        type: document.type,
        fileName: document.fileName,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        uploadedAt: document.uploadedAt,
        reviewNote: document.reviewNote,
      })),
    );
  }
}
