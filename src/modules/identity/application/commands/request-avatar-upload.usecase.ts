import { Injectable } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import {
  StorageService,
  UPLOAD_URL_TTL_SECONDS,
} from '../../../../platform/storage/storage.service';
import { assertImageUpload, InvalidUploadError } from '../../../../platform/storage/upload-policy';
import { RateLimitService } from '../../../../platform/rate-limit/rate-limit.service';
import { UploadRateLimitedError } from '../../domain/errors/identity.errors';

export interface RequestAvatarUploadCommand {
  readonly userId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface RequestAvatarUploadResult {
  readonly uploadUrl: string;
  readonly storageKey: string;
  readonly expiresIn: number;
}

// 05-API-SPEC.md §2 documents `PATCH /me` as "Update display name, avatar", but nothing ever
// minted a presigned URL for the avatar side of that. Mirrors the product-image/seller-document/
// channel-banner upload-url use cases exactly; no profile lookup is needed first (unlike those
// three) because the caller's own JwtGuard-verified id is all an avatar key needs.
@Injectable()
export class RequestAvatarUploadUseCase {
  constructor(
    private readonly storage: StorageService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async execute(
    cmd: RequestAvatarUploadCommand,
  ): Promise<Result<RequestAvatarUploadResult, UploadRateLimitedError | InvalidUploadError>> {
    // 05-API-SPEC.md §13: "Upload URL requests: 20/min per user".
    const limit = await this.rateLimit.check('uploadUrl', cmd.userId);
    if (!limit.allowed) {
      return Err(new UploadRateLimitedError(limit.retryAfterSeconds));
    }

    const policy = assertImageUpload(cmd.mimeType, cmd.sizeBytes);
    if (!policy.ok) {
      return Err(policy.error);
    }

    const storageKey = `avatars/${cmd.userId}/${generateId()}-${cmd.fileName}`;
    const uploadUrl = await this.storage.createPublicUploadUrl(storageKey, cmd.mimeType);

    return Ok({ uploadUrl, storageKey, expiresIn: UPLOAD_URL_TTL_SECONDS });
  }
}
