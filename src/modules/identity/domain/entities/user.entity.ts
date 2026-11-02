export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly phone: string | null;
  // null for an OAuth-only account (Google/Apple, no password ever set).
  readonly passwordHash: string | null;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly emailVerifiedAt: Date | null;
  readonly deletionRequestedAt: Date | null;
  readonly deletionScheduledAt: Date | null;
}

export function canAuthenticate(status: UserStatus): boolean {
  return status === 'ACTIVE';
}
