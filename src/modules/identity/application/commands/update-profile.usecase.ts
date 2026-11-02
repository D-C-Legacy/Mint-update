import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { StorageService } from '../../../../platform/storage/storage.service';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import {
  InvalidStorageKeyError,
  InvalidTokenError,
  PhoneAlreadyInUseError,
} from '../../domain/errors/identity.errors';
import { User } from '../../domain/entities/user.entity';

export interface UpdateProfileCommand {
  readonly userId: string;
  readonly displayName: string;
  /** Omit to leave the avatar unchanged, a storage key to set it, or null to clear it. */
  readonly avatarKey?: string | null;
  /** Omit to leave the phone number unchanged, a string to set it, or null to clear it. */
  readonly phone?: string | null;
}

// `PATCH /me` (05-API-SPEC.md §2: "Update display name, avatar"). `avatarKey` is a storage key
// minted by RequestAvatarUploadUseCase under `avatars/{userId}/...`; it's checked against that
// prefix before being turned into a public URL and stored on `User.avatarUrl` — same
// ownership-check pattern as AttachImageUseCase/AttachDocumentUseCase. `phone` is a later addition
// (founder feedback, 22 Oct 2026) — same unique-constraint-racing-the-DB shape as email at
// register, checked with a pre-read rather than catching the Prisma P2002 (matches the existing
// RegisterUseCase pattern instead of inventing a second one).
@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly storage: StorageService,
  ) {}

  async execute(
    cmd: UpdateProfileCommand,
  ): Promise<Result<User, InvalidTokenError | InvalidStorageKeyError | PhoneAlreadyInUseError>> {
    const existing = await this.users.findById(cmd.userId);
    if (!existing) {
      return Err(new InvalidTokenError());
    }

    if (
      cmd.avatarKey !== undefined &&
      cmd.avatarKey !== null &&
      !cmd.avatarKey.startsWith(`avatars/${cmd.userId}/`)
    ) {
      return Err(new InvalidStorageKeyError(cmd.userId));
    }

    if (cmd.phone !== undefined && cmd.phone !== null) {
      const owner = await this.users.findByPhone(cmd.phone);
      if (owner && owner.id !== cmd.userId) {
        return Err(new PhoneAlreadyInUseError(cmd.phone));
      }
    }

    let updated = await this.users.updateDisplayName(cmd.userId, cmd.displayName);

    if (cmd.avatarKey !== undefined) {
      const avatarUrl = cmd.avatarKey === null ? null : this.storage.getPublicUrl(cmd.avatarKey);
      updated = await this.users.updateAvatarUrl(cmd.userId, avatarUrl);
    }

    if (cmd.phone !== undefined) {
      updated = await this.users.updatePhone(cmd.userId, cmd.phone);
    }

    return Ok(updated);
  }
}
