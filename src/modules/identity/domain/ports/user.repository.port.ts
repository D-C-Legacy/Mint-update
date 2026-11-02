import { User } from '../entities/user.entity';

export const USER_REPOSITORY = Symbol('UserRepositoryPort');

export interface CreateUserInput {
  readonly id: string;
  readonly email: string;
  // Omitted (or null) for an OAuth-only sign-up (Google/Apple) with no password.
  readonly passwordHash?: string | null;
  readonly displayName: string;
  readonly emailVerifiedAt?: Date;
}

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  markEmailVerified(id: string, verifiedAt: Date): Promise<void>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  updateDisplayName(id: string, displayName: string): Promise<User>;
  /** `null` clears the avatar; a string sets it to that public URL. */
  updateAvatarUrl(id: string, avatarUrl: string | null): Promise<User>;
  /** `null` clears the phone number; a string sets it. */
  updatePhone(id: string, phone: string | null): Promise<User>;
  /** Sets both together: confirming the change link is what proves the new address, same as
   *  register's own verification — there is no unverified-new-email state to land in. */
  updateEmail(id: string, email: string, verifiedAt: Date): Promise<User>;

  // Apple App Store guideline 5.1.1(v) account-deletion feature (28 Oct 2026).
  scheduleDeletion(id: string, requestedAt: Date, scheduledAt: Date): Promise<User>;
  /** Clears both deletion timestamps — does nothing to status, which never left ACTIVE. */
  cancelDeletion(id: string): Promise<User>;
  /** Safety-net sweep target: anything still due that the delayed job might have dropped. */
  findDueForDeletion(before: Date, limit: number): Promise<readonly User[]>;
  /** One transaction: hard-deletes Session/Device/OAuthIdentity/UserPreference/UserAddress rows
   *  (cascade only fires on an actual row delete, and this keeps the User row), then scrubs the
   *  User row itself and sets status DELETED. `anonymizedEmail`/`anonymizedDisplayName` are
   *  computed by the caller so the repository stays free of ID-formatting decisions. */
  executeDeletion(
    id: string,
    anonymizedEmail: string,
    anonymizedDisplayName: string,
  ): Promise<User>;
}
