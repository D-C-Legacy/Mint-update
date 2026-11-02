import { Inject, Injectable } from '@nestjs/common';
import { PasswordService } from '../../../../platform/auth/password.service';
import { JwtService, PurposeTokenPayload } from '../../../../platform/auth/jwt.service';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import { SESSION_REPOSITORY, SessionRepositoryPort } from '../../domain/ports/session.repository.port';
import { InvalidTokenError } from '../../domain/errors/identity.errors';

export interface ResetPasswordCommand {
  readonly token: string;
  readonly newPassword: string;
}

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
  ) {}

  async execute(cmd: ResetPasswordCommand): Promise<Result<{ reset: true }, InvalidTokenError>> {
    let payload: PurposeTokenPayload;
    try {
      payload = this.jwt.verifyPurposeToken(cmd.token, 'password_reset');
    } catch {
      return Err(new InvalidTokenError());
    }

    const user = await this.users.findById(payload.sub);
    if (!user) {
      return Err(new InvalidTokenError());
    }

    const passwordHash = await this.passwords.hash(cmd.newPassword);
    const now = new Date();
    await this.users.updatePasswordHash(user.id, passwordHash);
    await this.sessions.revokeAllForUser(user.id, now);

    return Ok({ reset: true });
  }
}
