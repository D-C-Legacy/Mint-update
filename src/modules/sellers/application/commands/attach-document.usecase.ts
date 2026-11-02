import { Injectable, Inject } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import {
  SELLER_DOCUMENT_REPOSITORY,
  SellerDocumentRepositoryPort,
} from '../../domain/ports/seller-document.repository.port';
import {
  InvalidSellerStatusError,
  InvalidStorageKeyError,
  SellerApplicationNotFoundError,
} from '../../domain/errors/sellers.errors';
import { DocumentType } from '../../domain/entities/seller-document.entity';

export interface AttachDocumentCommand {
  readonly userId: string;
  readonly type: DocumentType;
  readonly storageKey: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface AttachDocumentResult {
  readonly documentId: string;
}

const STORAGE_KEY_PREFIX = 'seller-docs/';

@Injectable()
export class AttachDocumentUseCase {
  constructor(
    @Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort,
    @Inject(SELLER_DOCUMENT_REPOSITORY) private readonly documents: SellerDocumentRepositoryPort,
  ) {}

  async execute(
    cmd: AttachDocumentCommand,
  ): Promise<
    Result<
      AttachDocumentResult,
      SellerApplicationNotFoundError | InvalidSellerStatusError | InvalidStorageKeyError
    >
  > {
    const seller = await this.sellers.findByUserId(cmd.userId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`user ${cmd.userId}`));
    }
    if (seller.status !== 'DRAFT') {
      return Err(new InvalidSellerStatusError('attach a document', 'DRAFT', seller.status));
    }

    if (!cmd.storageKey.startsWith(`${STORAGE_KEY_PREFIX}${cmd.userId}/`)) {
      return Err(new InvalidStorageKeyError(cmd.userId));
    }

    const document = await this.documents.create({
      id: generateId(),
      applicationId: seller.application.id,
      type: cmd.type,
      storageKey: cmd.storageKey,
      fileName: cmd.fileName,
      mimeType: cmd.mimeType,
      sizeBytes: cmd.sizeBytes,
    });

    return Ok({ documentId: document.id });
  }
}
