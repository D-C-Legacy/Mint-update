import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import { PasswordService } from '../../../../platform/auth/password.service';
import { JwtService } from '../../../../platform/auth/jwt.service';
import { RefreshTokenService } from '../../../../platform/auth/refresh-token.service';
import { RateLimitService } from '../../../../platform/rate-limit/rate-limit.service';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { authConfig } from '../../../../config/auth.config';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import {
  SESSION_REPOSITORY,
  SessionRepositoryPort,
} from '../../domain/ports/session.repository.port';
import {
  InvalidCredentialsError,
  LoginRateLimitedError,
} from '../../domain/errors/identity.errors';
import { canAuthenticate } from '../../domain/entities/user.entity';

export interface LoginCommand {
  readonly email: string;
  readonly password: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
}

export interface AuthResult {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly refreshToken: string;
  readonly user: { readonly id: string; readonly displayName: string; readonly role: string };
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async execute(
    cmd: LoginCommand,
  ): Promise<Result<AuthResult, InvalidCredentialsError | LoginRateLimitedError>> {
    // 05-API-SPEC.md §13: 5 per 15 min per IP + email — keyed on the attempted email, not a
    // resolved user id, since most attempts here never resolve to one at all.
    const { allowed, retryAfterSeconds } = await this.rateLimit.check(
      'login',
      `${cmd.ipAddress ?? 'unknown'}:${cmd.email}`,
    );
    if (!allowed) {
      return Err(new LoginRateLimitedError(retryAfterSeconds));
    }

    const user = await this.users.findByEmail(cmd.email);
    // No passwordHash means an OAuth-only account (Google/Apple, never set one) — indistinguishable
    // from a wrong password on purpose, same "don't reveal account existence" rule as every other
    // branch here.
    if (!user || !canAuthenticate(user.status) || user.passwordHash === null) {
      return Err(new InvalidCredentialsError());
    }

    const passwordOk = await this.passwords.verify(user.passwordHash, cmd.password);
    if (!passwordOk) {
      return Err(new InvalidCredentialsError());
    }

    const now = new Date();
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

    const accessToken = this.jwt.signAccessToken({ sub: user.id, role: user.role });

    return Ok({
      accessToken,
      expiresIn: Math.floor(ms(authConfig.jwt.accessTtl) / 1000),
      refreshToken: generated.token,
      user: { id: user.id, displayName: user.displayName, role: user.role },
    });
  }
}
