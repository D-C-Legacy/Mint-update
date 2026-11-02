import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { StorageService } from '../../../../platform/storage/storage.service';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import {
  SELLER_DOCUMENT_REPOSITORY,
  SellerDocumentRepositoryPort,
} from '../../domain/ports/seller-document.repository.port';
import {
  InvalidSellerStatusError,
  SellerApplicationNotFoundError,
  SellerDocumentNotFoundError,
} from '../../domain/errors/sellers.errors';

export interface RemoveDocumentCommand {
  readonly userId: string;
  readonly documentId: string;
}

export interface RemoveDocumentResult {
  readonly documentId: string;
}

@Injectable()
export class RemoveDocumentUseCase {
  constructor(
    @Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort,
    @Inject(SELLER_DOCUMENT_REPOSITORY) private readonly documents: SellerDocumentRepositoryPort,
    private readonly storage: StorageService,
  ) {}

  async execute(
    cmd: RemoveDocumentCommand,
  ): Promise<
    Result<
      RemoveDocumentResult,
      SellerApplicationNotFoundError | InvalidSellerStatusError | SellerDocumentNotFoundError
    >
  > {
    const seller = await this.sellers.findByUserId(cmd.userId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`user ${cmd.userId}`));
    }
    if (seller.status !== 'DRAFT') {
      return Err(new InvalidSellerStatusError('remove a document', 'DRAFT', seller.status));
    }

    // Read the key before deleting the row so the private object can be removed from S3 too.
    const document = await this.documents.findById(cmd.documentId);
    if (!document || document.applicationId !== seller.application.id) {
      return Err(new SellerDocumentNotFoundError(cmd.documentId));
    }

    await this.documents.deleteForApplication(cmd.documentId, seller.application.id);
    await this.storage.deletePrivateObject(document.storageKey);

    return Ok({ documentId: cmd.documentId });
  }
}
