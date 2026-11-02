import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '../../../../platform/auth/jwt.service';
import { PasswordService } from '../../../../platform/auth/password.service';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import {
  CurrentPasswordIncorrectError,
  EmailAlreadyRegisteredError,
  InvalidTokenError,
} from '../../domain/errors/identity.errors';
import { emailChangeRequestedEvent } from '../../events/published/email-change-requested.event';

export interface RequestEmailChangeCommand {
  readonly userId: string;
  readonly currentPassword: string;
  readonly newEmail: string;
}

const EMAIL_CHANGE_TTL = '24h';

// Step 1 of 2 (ConfirmEmailChangeUseCase is step 2). Mirrors ChangePasswordUseCase's
// current-password check, but nothing on User changes here — only once the confirm link is used.
@Injectable()
export class RequestEmailChangeUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    cmd: RequestEmailChangeCommand,
  ): Promise<
    Result<
      { sent: true },
      InvalidTokenError | CurrentPasswordIncorrectError | EmailAlreadyRegisteredError
    >
  > {
    const user = await this.users.findById(cmd.userId);
    if (!user) {
      return Err(new InvalidTokenError());
    }

    // An OAuth-only account (no passwordHash yet) has no "current password" to verify against.
    const passwordOk =
      user.passwordHash !== null &&
      (await this.passwords.verify(user.passwordHash, cmd.currentPassword));
    if (!passwordOk) {
      return Err(new CurrentPasswordIncorrectError());
    }

    const existing = await this.users.findByEmail(cmd.newEmail);
    if (existing) {
      return Err(new EmailAlreadyRegisteredError(cmd.newEmail));
    }

    const confirmToken = this.jwt.signPurposeToken(
      { sub: user.id, purpose: 'email_change', newEmail: cmd.newEmail },
      EMAIL_CHANGE_TTL,
    );

    await this.eventBus.publish(
      emailChangeRequestedEvent({
        userId: user.id,
        oldEmail: user.email,
        newEmail: cmd.newEmail,
        confirmToken,
      }),
    );

    return Ok({ sent: true });
  }
}
