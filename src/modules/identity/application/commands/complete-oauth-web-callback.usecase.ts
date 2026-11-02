import { Inject, Injectable } from '@nestjs/common';
import { Result } from '../../../../shared/result/result';
import { OAuthProviderName } from '../../domain/entities/oauth-identity.entity';
import {
  InvalidCredentialsError,
  OAuthRateLimitedError,
  OAuthTokenInvalidError,
} from '../../domain/errors/identity.errors';
import {
  GOOGLE_OAUTH_CODE_EXCHANGER,
  APPLE_OAUTH_CODE_EXCHANGER,
  OAuthCodeExchangerPort,
} from '../ports/oauth-code-exchanger.port';
import { SignInWithProviderUseCase } from './sign-in-with-provider.usecase';
import { AuthResult } from './login.usecase';

export interface CompleteOAuthWebCallbackCommand {
  readonly provider: OAuthProviderName;
  readonly code: string;
  // Apple's form_post callback includes this on the account's first-ever authorization only.
  readonly fallbackDisplayName?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

// The second half of the web OAuth redirect flow: GET /auth/google/callback and
// POST /auth/apple/callback both land here after the provider redirects back with an
// authorization `code`. Trades that code for an id_token (provider-specific HTTP exchange,
// infra/oauth/*-code-exchange.ts), then hands off to the exact same SignInWithProviderUseCase
// native sign-in uses — one piece of account-resolution logic for every entry point.
@Injectable()
export class CompleteOAuthWebCallbackUseCase {
  constructor(
    @Inject(GOOGLE_OAUTH_CODE_EXCHANGER) private readonly googleExchanger: OAuthCodeExchangerPort,
    @Inject(APPLE_OAUTH_CODE_EXCHANGER) private readonly appleExchanger: OAuthCodeExchangerPort,
    private readonly signInWithProvider: SignInWithProviderUseCase,
  ) {}

  async execute(
    cmd: CompleteOAuthWebCallbackCommand,
  ): Promise<
    Result<AuthResult, InvalidCredentialsError | OAuthTokenInvalidError | OAuthRateLimitedError>
  > {
    const exchanger = cmd.provider === 'GOOGLE' ? this.googleExchanger : this.appleExchanger;
    const { idToken } = await exchanger.exchange(cmd.code);

    return this.signInWithProvider.execute({
      provider: cmd.provider,
      idToken,
      context: 'web',
      ...(cmd.fallbackDisplayName !== undefined
        ? { fallbackDisplayName: cmd.fallbackDisplayName }
        : {}),
      ...(cmd.ipAddress !== undefined ? { ipAddress: cmd.ipAddress } : {}),
      ...(cmd.userAgent !== undefined ? { userAgent: cmd.userAgent } : {}),
    });
  }
}
