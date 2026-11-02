import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import { JwtService } from '../../../../platform/auth/jwt.service';
import { RefreshTokenService } from '../../../../platform/auth/refresh-token.service';
import { RateLimitService } from '../../../../platform/rate-limit/rate-limit.service';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { authConfig } from '../../../../config/auth.config';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import {
  OAUTH_IDENTITY_REPOSITORY,
  OAuthIdentityRepositoryPort,
} from '../../domain/ports/oauth-identity.repository.port';
import {
  SESSION_REPOSITORY,
  SessionRepositoryPort,
} from '../../domain/ports/session.repository.port';
import { canAuthenticate, User } from '../../domain/entities/user.entity';
import { OAuthProviderName } from '../../domain/entities/oauth-identity.entity';
import {
  InvalidCredentialsError,
  OAuthRateLimitedError,
  OAuthTokenInvalidError,
} from '../../domain/errors/identity.errors';
import {
  GOOGLE_OAUTH_VERIFIER,
  APPLE_OAUTH_VERIFIER,
  OAuthVerifierPort,
  OAuthVerifyContext,
} from '../ports/oauth-verifier.port';
import { AuthResult } from './login.usecase';

export interface SignInWithProviderCommand {
  readonly provider: OAuthProviderName;
  readonly idToken: string;
  readonly context: OAuthVerifyContext;
  // Apple only ever sends a real name on the account's very first authorization for this app —
  // the native/web callers capture it then and pass it through here for a brand-new sign-up.
  // Google's id token already carries a name claim, so this is ignored for that provider.
  readonly fallbackDisplayName?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

@Injectable()
export class SignInWithProviderUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(OAUTH_IDENTITY_REPOSITORY)
    private readonly oauthIdentities: OAuthIdentityRepositoryPort,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    @Inject(GOOGLE_OAUTH_VERIFIER) private readonly googleVerifier: OAuthVerifierPort,
    @Inject(APPLE_OAUTH_VERIFIER) private readonly appleVerifier: OAuthVerifierPort,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async execute(
    cmd: SignInWithProviderCommand,
  ): Promise<
    Result<AuthResult, InvalidCredentialsError | OAuthTokenInvalidError | OAuthRateLimitedError>
  > {
    // Not in 05-API-SPEC.md §13 — OAuth isn't in the docs at all (see rate-limit.config.ts's own
    // comment on the `oauth` scope). IP-keyed only: unlike login there is no attempted email to
    // key on up front, verification happens after this check.
    const { allowed, retryAfterSeconds } = await this.rateLimit.check(
      'oauth',
      cmd.ipAddress ?? 'unknown',
    );
    if (!allowed) {
      return Err(new OAuthRateLimitedError(retryAfterSeconds));
    }

    const verifier: OAuthVerifierPort =
      cmd.provider === 'GOOGLE' ? this.googleVerifier : this.appleVerifier;
    const claims = await verifier.verify(cmd.idToken, cmd.context);
    if (!claims.emailVerified) {
      return Err(new OAuthTokenInvalidError(cmd.provider));
    }

    const existingIdentity = await this.oauthIdentities.findByProviderIdentity(
      cmd.provider,
      claims.providerId,
    );

    const email = claims.email;
    if (!existingIdentity && !email) {
      // Only Apple's "private relay" email is ever plausible here, and that is still a real,
      // deliverable email address — every provider path has returned an email so far in
      // practice. No account can be created without one (User.email is required and unique).
      return Err(new OAuthTokenInvalidError(cmd.provider));
    }

    const user = existingIdentity
      ? await this.users.findById(existingIdentity.userId)
      : // Cast is safe: the guard immediately above already returned when !existingIdentity && !email.
        await this.resolveOrCreateUser(cmd, { email: email as string, name: claims.name });

    if (!user || !canAuthenticate(user.status)) {
      return Err(new InvalidCredentialsError());
    }

    if (!existingIdentity) {
      await this.oauthIdentities.create({
        id: generateId(),
        userId: user.id,
        provider: cmd.provider,
        providerId: claims.providerId,
        email: claims.email,
      });
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

  // No identity row yet for this (provider, providerId) pair, and claims.email is known
  // non-null (checked by the caller before this runs). Links to an existing password account
  // with the same verified email if one exists, otherwise this is a brand-new sign-up.
  private async resolveOrCreateUser(
    cmd: SignInWithProviderCommand,
    claims: { email: string; name: string | null },
  ): Promise<User> {
    const existing = await this.users.findByEmail(claims.email);
    if (existing) return existing;

    return this.users.create({
      id: generateId(),
      email: claims.email,
      displayName:
        claims.name ?? cmd.fallbackDisplayName ?? claims.email.split('@')[0] ?? 'Swish user',
      emailVerifiedAt: new Date(),
    });
  }
}
