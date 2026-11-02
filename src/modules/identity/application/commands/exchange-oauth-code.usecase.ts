import { Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { InvalidTokenError } from '../../domain/errors/identity.errors';
import { OAuthExchangeCodeService } from '../../infra/oauth/oauth-exchange-code.service';
import { AuthResult } from './login.usecase';

export interface ExchangeOAuthCodeCommand {
  readonly code: string;
}

// POST /auth/exchange-code — the step that lets a web sign-in finish: the backend's
// GET/POST /auth/<provider>/callback already computed the real AuthResult and stashed it behind
// a short-lived one-time code (OAuthExchangeCodeService) rather than putting real tokens in the
// redirect URL. This trades that code for the real tokens, once.
@Injectable()
export class ExchangeOAuthCodeUseCase {
  constructor(private readonly exchangeCodes: OAuthExchangeCodeService) {}

  async execute(cmd: ExchangeOAuthCodeCommand): Promise<Result<AuthResult, InvalidTokenError>> {
    const result = await this.exchangeCodes.consume(cmd.code);
    if (!result) {
      return Err(new InvalidTokenError('OAuth exchange code is invalid or expired'));
    }
    return Ok(result);
  }
}
