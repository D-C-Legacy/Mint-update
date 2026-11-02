import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import { PasswordService } from '../../../../platform/auth/password.service';
import { JwtService } from '../../../../platform/auth/jwt.service';
import { RefreshTokenService } from '../../../../platform/auth/refresh-token.service';
import { RateLimitService } from '../../../../platform/rate-limit/rate-limit.service';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { authConfig } from '../../../../config/auth.config';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import {
  SESSION_REPOSITORY,
  SessionRepositoryPort,
} from '../../domain/ports/session.repository.port';
import {
  CurrentPasswordIncorrectError,
  InvalidTokenError,
  LoginRateLimitedError,
} from '../../domain/errors/identity.errors';
import { passwordChangedEvent } from '../../events/published/password-changed.event';
import { AuthResult } from './login.usecase';

export interface ChangePasswordCommand {
  readonly userId: string;
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
}

// Not in 05-API-SPEC.md (user-directed addition for the app's Security screen). Verifies the
// current password, signs every session out (a changed password should end other devices), then
// opens one fresh session and returns its tokens so the device that made the change stays signed in.
@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly rateLimit: RateLimitService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    cmd: ChangePasswordCommand,
  ): Promise<
    Result<AuthResult, InvalidTokenError | CurrentPasswordIncorrectError | LoginRateLimitedError>
  > {
    // Same budget as login (5 per 15 min): a stolen access token must not be a free way to
    // guess the account's current password.
    const { allowed, retryAfterSeconds } = await this.rateLimit.check(
      'login',
      `change-password:${cmd.userId}`,
    );
    if (!allowed) {
      return Err(new LoginRateLimitedError(retryAfterSeconds));
    }

    const user = await this.users.findById(cmd.userId);
    if (!user) {
      return Err(new InvalidTokenError());
    }

    // An OAuth-only account (no passwordHash yet) has no "current password" to verify against —
    // setting a first password is a separate, unbuilt flow, out of scope here.
    const currentOk =
      user.passwordHash !== null &&
      (await this.passwords.verify(user.passwordHash, cmd.currentPassword));
    if (!currentOk) {
      return Err(new CurrentPasswordIncorrectError());
    }

    const now = new Date();
    await this.users.updatePasswordHash(user.id, await this.passwords.hash(cmd.newPassword));
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

    await this.eventBus.publish(passwordChangedEvent({ userId: user.id }));

    return Ok({
      accessToken: this.jwt.signAccessToken({ sub: user.id, role: user.role }),
      expiresIn: Math.floor(ms(authConfig.jwt.accessTtl) / 1000),
      refreshToken: generated.token,
      user: { id: user.id, displayName: user.displayName, role: user.role },
    });
  }
}
