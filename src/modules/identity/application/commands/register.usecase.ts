import { Inject, Injectable } from '@nestjs/common';
import { PasswordService } from '../../../../platform/auth/password.service';
import { RateLimitService } from '../../../../platform/rate-limit/rate-limit.service';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import {
  EmailAlreadyRegisteredError,
  RegisterRateLimitedError,
} from '../../domain/errors/identity.errors';
import { EMAIL_NOTIFIER, EmailNotifierPort } from '../ports/email-notifier.port';
import { EmailVerificationCodeService } from '../../infra/notifications/email-verification-code.service';
import { User } from '../../domain/entities/user.entity';

export interface RegisterCommand {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly ipAddress?: string;
}

export interface RegisterResult {
  readonly user: Pick<User, 'id' | 'displayName' | 'role'>;
}

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly passwords: PasswordService,
    private readonly verificationCodes: EmailVerificationCodeService,
    @Inject(EMAIL_NOTIFIER) private readonly emailNotifier: EmailNotifierPort,
    private readonly rateLimit: RateLimitService,
  ) {}

  async execute(
    cmd: RegisterCommand,
  ): Promise<Result<RegisterResult, EmailAlreadyRegisteredError | RegisterRateLimitedError>> {
    // 05-API-SPEC.md §13: 3 per hour per IP.
    const { allowed, retryAfterSeconds } = await this.rateLimit.check(
      'register',
      cmd.ipAddress ?? 'unknown',
    );
    if (!allowed) {
      return Err(new RegisterRateLimitedError(retryAfterSeconds));
    }

    const existing = await this.users.findByEmail(cmd.email);
    if (existing) {
      return Err(new EmailAlreadyRegisteredError(cmd.email));
    }

    const passwordHash = await this.passwords.hash(cmd.password);
    const user = await this.users.create({
      id: generateId(),
      email: cmd.email,
      passwordHash,
      displayName: cmd.displayName,
    });

    const code = await this.verificationCodes.issue(user.id);
    await this.emailNotifier.sendVerificationEmail(user.email, code);

    return Ok({ user: { id: user.id, displayName: user.displayName, role: user.role } });
  }
}
