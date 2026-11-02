import { Injectable, Inject } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import {
  StorageService,
  UPLOAD_URL_TTL_SECONDS,
} from '../../../../platform/storage/storage.service';
import { assertImageUpload, InvalidUploadError } from '../../../../platform/storage/upload-policy';
import { RateLimitService } from '../../../../platform/rate-limit/rate-limit.service';
import { SellersService } from '../../../sellers/application/sellers.service';
import { requireApprovedSellerId } from '../require-approved-seller';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '../../domain/ports/product.repository.port';
import {
  ProductNotFoundError,
  SellerNotApprovedError,
  SellerProfileNotFoundError,
  UploadRateLimitedError,
} from '../../domain/errors/catalog.errors';

export interface RequestImageUploadCommand {
  readonly userId: string;
  readonly productId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface RequestImageUploadResult {
  readonly uploadUrl: string;
  readonly storageKey: string;
  readonly expiresIn: number;
}

@Injectable()
export class RequestImageUploadUseCase {
  constructor(
    private readonly sellers: SellersService,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
    private readonly storage: StorageService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async execute(
    cmd: RequestImageUploadCommand,
  ): Promise<
    Result<
      RequestImageUploadResult,
      | SellerProfileNotFoundError
      | SellerNotApprovedError
      | ProductNotFoundError
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
    const policy = assertImageUpload(cmd.mimeType, cmd.sizeBytes);
    if (!policy.ok) {
      return Err(policy.error);
    }

    const sellerResult = await requireApprovedSellerId(this.sellers, cmd.userId);
    if (!sellerResult.ok) {
      return Err(sellerResult.error);
    }

    const product = await this.products.findByIdForSeller(cmd.productId, sellerResult.value);
    if (!product) {
      return Err(new ProductNotFoundError(cmd.productId));
    }

    const storageKey = `products/${product.id}/${generateId()}-${cmd.fileName}`;
    const uploadUrl = await this.storage.createPublicUploadUrl(storageKey, cmd.mimeType);

    return Ok({ uploadUrl, storageKey, expiresIn: UPLOAD_URL_TTL_SECONDS });
  }
}
