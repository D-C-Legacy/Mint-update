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
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../domain/ports/channel.repository.port';
import { ChannelNotFoundError, UploadRateLimitedError } from '../../domain/errors/channels.errors';

export interface RequestChannelBannerUploadCommand {
  readonly userId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface RequestChannelBannerUploadResult {
  readonly uploadUrl: string;
  readonly storageKey: string;
  readonly expiresIn: number;
}

// POST /v1/channel/banner/upload-url. `PATCH /channel` already accepts a `bannerKey`, but nothing
// minted a presigned URL for it, so a seller could never actually set a banner. Same 20/min
// upload-url scope and image policy as product images.
@Injectable()
export class RequestChannelBannerUploadUseCase {
  constructor(
    private readonly sellers: SellersService,
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    private readonly storage: StorageService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async execute(
    cmd: RequestChannelBannerUploadCommand,
  ): Promise<
    Result<
      RequestChannelBannerUploadResult,
      ChannelNotFoundError | UploadRateLimitedError | InvalidUploadError
    >
  > {
    // 05-API-SPEC.md §13: "Upload URL requests: 20/min per user".
    const limit = await this.rateLimit.check('uploadUrl', cmd.userId);
    if (!limit.allowed) {
      return Err(new UploadRateLimitedError(limit.retryAfterSeconds));
    }

    const policy = assertImageUpload(cmd.mimeType, cmd.sizeBytes);
    if (!policy.ok) {
      return Err(policy.error);
    }

    const sellerResult = await this.sellers.getMySeller({ userId: cmd.userId });
    if (!sellerResult.ok) {
      return Err(new ChannelNotFoundError(`seller for user ${cmd.userId}`));
    }

    const channel = await this.channels.findBySellerId(sellerResult.value.seller.id);
    if (!channel) {
      return Err(new ChannelNotFoundError(`seller ${sellerResult.value.seller.id}`));
    }

    const storageKey = `channels/${channel.id}/${generateId()}-${cmd.fileName}`;
    const uploadUrl = await this.storage.createPublicUploadUrl(storageKey, cmd.mimeType);

    return Ok({ uploadUrl, storageKey, expiresIn: UPLOAD_URL_TTL_SECONDS });
  }
}
