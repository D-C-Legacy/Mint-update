import { Injectable, Inject } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import {
  StorageService,
  UPLOAD_URL_TTL_SECONDS,
} from '../../../../platform/storage/storage.service';
import {
  assertDocumentUpload,
  InvalidUploadError,
} from '../../../../platform/storage/upload-policy';
import { RateLimitService } from '../../../../platform/rate-limit/rate-limit.service';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import {
  InvalidSellerStatusError,
  SellerApplicationNotFoundError,
  UploadRateLimitedError,
} from '../../domain/errors/sellers.errors';
import { DocumentType } from '../../domain/entities/seller-document.entity';

export interface RequestDocumentUploadCommand {
  readonly userId: string;
  readonly type: DocumentType;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface RequestDocumentUploadResult {
  readonly uploadUrl: string;
  readonly storageKey: string;
  readonly expiresIn: number;
}

@Injectable()
export class RequestDocumentUploadUseCase {
  constructor(
    @Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort,
    private readonly storage: StorageService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async execute(
    cmd: RequestDocumentUploadCommand,
  ): Promise<
    Result<
      RequestDocumentUploadResult,
      | SellerApplicationNotFoundError
      | InvalidSellerStatusError
      | UploadRateLimitedError
      | InvalidUploadError
    >
  > {
    // 05-API-SPEC.md §13: "Upload URL requests: 20/min per user".
    const limit = await this.rateLimit.check('uploadUrl', cmd.userId);
    if (!limit.allowed) {
      return Err(new UploadRateLimitedError(limit.retryAfterSeconds));
    }

    // Server-side guard on the declared type/size before a URL is issued.
    const policy = assertDocumentUpload(cmd.mimeType, cmd.sizeBytes);
    if (!policy.ok) {
      return Err(policy.error);
    }

    const seller = await this.sellers.findByUserId(cmd.userId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`user ${cmd.userId}`));
    }
    if (seller.status !== 'DRAFT') {
      return Err(new InvalidSellerStatusError('upload a document', 'DRAFT', seller.status));
    }

    // The key is namespaced by userId so AttachDocumentUseCase can verify a document's key was
    // minted for the caller before recording it.
    const storageKey = `seller-docs/${cmd.userId}/${generateId()}-${cmd.fileName}`;
    const uploadUrl = await this.storage.createPrivateUploadUrl(storageKey, cmd.mimeType);

    return Ok({ uploadUrl, storageKey, expiresIn: UPLOAD_URL_TTL_SECONDS });
  }
}
