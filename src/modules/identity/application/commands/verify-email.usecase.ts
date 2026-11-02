import { Inject, Injectable } from '@nestjs/common';
import { RateLimitService } from '../../../../platform/rate-limit/rate-limit.service';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import {
  InvalidTokenError,
  VerifyEmailRateLimitedError,
} from '../../domain/errors/identity.errors';
import { EmailVerificationCodeService } from '../../infra/notifications/email-verification-code.service';

export interface VerifyEmailCommand {
  readonly token: string;
  readonly ipAddress?: string;
}

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly verificationCodes: EmailVerificationCodeService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async execute(
    cmd: VerifyEmailCommand,
  ): Promise<Result<{ verified: true }, InvalidTokenError | VerifyEmailRateLimitedError>> {
    const { allowed, retryAfterSeconds } = await this.rateLimit.check(
      'verifyEmail',
      cmd.ipAddress ?? 'unknown',
    );
    if (!allowed) {
      return Err(new VerifyEmailRateLimitedError(retryAfterSeconds));
    }

    const userId = await this.verificationCodes.consume(cmd.token);
    if (!userId) {
      return Err(new InvalidTokenError());
    }

    const user = await this.users.findById(userId);
    if (!user) {
      return Err(new InvalidTokenError());
    }

    await this.users.markEmailVerified(user.id, new Date());

    return Ok({ verified: true });
  }
}
