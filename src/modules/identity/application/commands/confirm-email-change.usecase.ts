import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import { JwtService, PurposeTokenPayload } from '../../../../platform/auth/jwt.service';
import { RefreshTokenService } from '../../../../platform/auth/refresh-token.service';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { authConfig } from '../../../../config/auth.config';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import {
  SESSION_REPOSITORY,
  SessionRepositoryPort,
} from '../../domain/ports/session.repository.port';
import {
  EmailAlreadyRegisteredError,
  InvalidTokenError,
} from '../../domain/errors/identity.errors';
import { AuthResult } from './login.usecase';

export interface ConfirmEmailChangeCommand {
  readonly token: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
}

// Step 2 of 2 (RequestEmailChangeUseCase is step 1). The token carries the new email itself —
// there is no separate pending-email row to read back, same stateless shape as email_verification.
// Revokes every other session and issues a fresh one, same reasoning ChangePasswordUseCase already
// has: the account's login identity just changed.
@Injectable()
export class ConfirmEmailChangeUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  async execute(
    cmd: ConfirmEmailChangeCommand,
  ): Promise<Result<AuthResult, InvalidTokenError | EmailAlreadyRegisteredError>> {
    let payload: PurposeTokenPayload;
    try {
      payload = this.jwt.verifyPurposeToken(cmd.token, 'email_change');
    } catch {
      return Err(new InvalidTokenError());
    }
    const newEmail = payload.newEmail;
    if (!newEmail) {
      return Err(new InvalidTokenError());
    }

    const user = await this.users.findById(payload.sub);
    if (!user) {
      return Err(new InvalidTokenError());
    }

    // Re-checked here: someone else could have registered or changed into this exact email during
    // the token's 24h window.
    const existing = await this.users.findByEmail(newEmail);
    if (existing && existing.id !== user.id) {
      return Err(new EmailAlreadyRegisteredError(newEmail));
    }

    const now = new Date();
    const updated = await this.users.updateEmail(user.id, newEmail, now);
    await this.sessions.revokeAllForUser(user.id, now);

    const generated = this.refreshTokens.generate(now);
    await this.sessions.create({
      id: generateId(),
      userId: user.id,
      refreshTokenHash: generated.tokenHash,
      familyId: generated.familyId,
      expiresAt: generated.expiresAt,
      ...(cmd.userAgent !== undefined ? { userAgent: cmd.userAgent } : {}),
      ...(cmd.ipAddress !== undefined ? { ipAddress: cmd.ipAddress } : {}),
    });

    return Ok({
      accessToken: this.jwt.signAccessToken({ sub: updated.id, role: updated.role }),
      expiresIn: Math.floor(ms(authConfig.jwt.accessTtl) / 1000),
      refreshToken: generated.token,
      user: { id: updated.id, displayName: updated.displayName, role: updated.role },
    });
  }
}
