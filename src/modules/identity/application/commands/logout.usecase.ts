import { Inject, Injectable } from '@nestjs/common';
import { RefreshTokenService } from '../../../../platform/auth/refresh-token.service';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SESSION_REPOSITORY, SessionRepositoryPort } from '../../domain/ports/session.repository.port';
import { InvalidTokenError } from '../../domain/errors/identity.errors';

export interface LogoutCommand {
  readonly userId: string;
  readonly refreshToken: string;
}

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  async execute(cmd: LogoutCommand): Promise<Result<{ loggedOut: true }, InvalidTokenError>> {
    const presentedHash = this.refreshTokens.hash(cmd.refreshToken);
    const session = await this.sessions.findByRefreshTokenHash(presentedHash);

    if (!session || session.userId !== cmd.userId) {
      return Err(new InvalidTokenError());
    }

    await this.sessions.revokeFamily(session.familyId, new Date());

    return Ok({ loggedOut: true });
  }
}
