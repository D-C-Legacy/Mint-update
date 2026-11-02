import { randomBytes, createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { authConfig } from '../../config/auth.config';
import { generateId } from '../../shared/ids/id';

export interface GeneratedRefreshToken {
  readonly token: string;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly expiresAt: Date;
}

export interface StoredRefreshToken {
  readonly tokenHash: string;
  readonly revokedAt: Date | null;
  readonly expiresAt: Date;
}

export type RefreshTokenRejection = 'EXPIRED' | 'REUSE_DETECTED';

export type RefreshTokenVerification =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: RefreshTokenRejection };

@Injectable()
export class RefreshTokenService {
  generate(now: Date, familyId?: string): GeneratedRefreshToken {
    const token = randomBytes(32).toString('hex');
    return {
      token,
      tokenHash: this.hash(token),
      familyId: familyId ?? generateId(),
      expiresAt: new Date(now.getTime() + ms(authConfig.jwt.refreshTtl)),
    };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  verify(presentedTokenHash: string, stored: StoredRefreshToken, now: Date): RefreshTokenVerification {
    if (stored.revokedAt || stored.tokenHash !== presentedTokenHash) {
      return { ok: false, reason: 'REUSE_DETECTED' };
    }
    if (stored.expiresAt < now) {
      return { ok: false, reason: 'EXPIRED' };
    }
    return { ok: true };
  }
}
