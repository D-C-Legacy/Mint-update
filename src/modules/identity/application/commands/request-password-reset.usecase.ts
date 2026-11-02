import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '../../../../platform/auth/jwt.service';
import { Result, Ok } from '../../../../shared/result/result';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import { EMAIL_NOTIFIER, EmailNotifierPort } from '../ports/email-notifier.port';

export interface RequestPasswordResetCommand {
  readonly email: string;
}

const PASSWORD_RESET_TTL = '1h';

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly jwt: JwtService,
    @Inject(EMAIL_NOTIFIER) private readonly emailNotifier: EmailNotifierPort,
  ) {}

  async execute(cmd: RequestPasswordResetCommand): Promise<Result<{ sent: true }, never>> {
    const user = await this.users.findByEmail(cmd.email);
    if (user) {
      const token = this.jwt.signPurposeToken({ sub: user.id, purpose: 'password_reset' }, PASSWORD_RESET_TTL);
      await this.emailNotifier.sendPasswordResetEmail(user.email, token);
    }

    return Ok({ sent: true });
  }
}
