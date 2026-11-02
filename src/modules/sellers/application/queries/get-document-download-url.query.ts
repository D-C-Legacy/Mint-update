import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { StorageService } from '../../../../platform/storage/storage.service';
import {
  SELLER_DOCUMENT_REPOSITORY,
  SellerDocumentRepositoryPort,
} from '../../domain/ports/seller-document.repository.port';
import { SellerDocumentNotFoundError } from '../../domain/errors/sellers.errors';

export interface GetDocumentDownloadUrlCommand {
  readonly documentId: string;
}

export interface GetDocumentDownloadUrlResult {
  readonly url: string;
  readonly storageKey: string;
}

@Injectable()
export class GetDocumentDownloadUrlQuery {
  constructor(
    @Inject(SELLER_DOCUMENT_REPOSITORY) private readonly documents: SellerDocumentRepositoryPort,
    private readonly storage: StorageService,
  ) {}

  async execute(
    cmd: GetDocumentDownloadUrlCommand,
  ): Promise<Result<GetDocumentDownloadUrlResult, SellerDocumentNotFoundError>> {
    const document = await this.documents.findById(cmd.documentId);
    if (!document) {
      return Err(new SellerDocumentNotFoundError(cmd.documentId));
    }

    const url = await this.storage.createPrivateDownloadUrl(document.storageKey);
    return Ok({ url, storageKey: document.storageKey });
  }
}
