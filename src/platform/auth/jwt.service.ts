import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { authConfig } from '../../config/auth.config';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface PurposeTokenPayload {
  sub: string;
  purpose: 'email_verification' | 'password_reset' | 'email_change';
  // Only set for 'email_change': the token is the only state linking a change request to its
  // confirmation (no separate pending-email table), same stateless shape as the other two purposes.
  newEmail?: string;
}

@Injectable()
export class JwtService {
  signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, authConfig.jwt.accessSecret, {
      expiresIn: authConfig.jwt.accessTtl,
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, authConfig.jwt.accessSecret) as AccessTokenPayload;
  }

  signPurposeToken(payload: PurposeTokenPayload, ttl: string): string {
    return jwt.sign(payload, authConfig.jwt.accessSecret, { expiresIn: ttl });
  }

  verifyPurposeToken(token: string, purpose: PurposeTokenPayload['purpose']): PurposeTokenPayload {
    const decoded = jwt.verify(token, authConfig.jwt.accessSecret) as PurposeTokenPayload;
    if (decoded.purpose !== purpose) {
      throw new Error('Token purpose mismatch');
    }
    return decoded;
  }
}
