import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import { JwtService } from '../../../../platform/auth/jwt.service';
import { RefreshTokenService } from '../../../../platform/auth/refresh-token.service';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { authConfig } from '../../../../config/auth.config';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import { SESSION_REPOSITORY, SessionRepositoryPort } from '../../domain/ports/session.repository.port';
import { InvalidTokenError } from '../../domain/errors/identity.errors';
import { AuthResult } from './login.usecase';

export interface RefreshCommand {
  readonly refreshToken: string;
}

@Injectable()
export class RefreshUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  async execute(cmd: RefreshCommand): Promise<Result<AuthResult, InvalidTokenError>> {
    const now = new Date();
    const presentedHash = this.refreshTokens.hash(cmd.refreshToken);
    const session = await this.sessions.findByRefreshTokenHash(presentedHash);

    if (!session) {
      return Err(new InvalidTokenError());
    }

    const decision = this.refreshTokens.verify(
      presentedHash,
      { tokenHash: session.refreshTokenHash, revokedAt: session.revokedAt, expiresAt: session.expiresAt },
      now,
    );
    if (!decision.ok) {
      if (decision.reason === 'REUSE_DETECTED') {
        await this.sessions.revokeFamily(session.familyId, now);
      }
      return Err(new InvalidTokenError());
    }

    const user = await this.users.findById(session.userId);
    if (!user) {
      return Err(new InvalidTokenError());
    }

    await this.sessions.revoke(session.id, now);

    const generated = this.refreshTokens.generate(now, session.familyId);
    await this.sessions.create({
      id: generateId(),
      userId: user.id,
      refreshTokenHash: generated.tokenHash,
      familyId: generated.familyId,
      expiresAt: generated.expiresAt,
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
