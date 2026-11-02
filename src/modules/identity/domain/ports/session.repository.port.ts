export const SESSION_REPOSITORY = Symbol('SessionRepositoryPort');

export interface CreateSessionInput {
  readonly id: string;
  readonly userId: string;
  readonly refreshTokenHash: string;
  readonly familyId: string;
  readonly expiresAt: Date;
  readonly userAgent?: string;
  readonly ipAddress?: string;
}

export interface SessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly refreshTokenHash: string;
  readonly familyId: string;
  readonly revokedAt: Date | null;
  readonly expiresAt: Date;
}

export interface SessionRepositoryPort {
  create(input: CreateSessionInput): Promise<SessionRecord>;
  findByRefreshTokenHash(hash: string): Promise<SessionRecord | null>;
  revoke(id: string, revokedAt: Date): Promise<void>;
  revokeFamily(familyId: string, revokedAt: Date): Promise<void>;
  revokeAllForUser(userId: string, revokedAt: Date): Promise<void>;
}
