import { Injectable } from '@nestjs/common';
import { oauthConfig } from '../../../../config/oauth.config';
import {
  OAuthVerifierPort,
  OAuthVerifyContext,
  VerifiedOAuthClaims,
} from '../../application/ports/oauth-verifier.port';
import {
  OAuthProviderNotConfiguredError,
  OAuthTokenInvalidError,
} from '../../domain/errors/identity.errors';
import { verifyAgainstJwks } from './jwks-verify.util';

const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

@Injectable()
export class AppleOAuthVerifier implements OAuthVerifierPort {
  async verify(idToken: string, context: OAuthVerifyContext): Promise<VerifiedOAuthClaims> {
    const { servicesId, bundleId } = oauthConfig.apple;
    const audience = context === 'web' ? servicesId : bundleId;
    if (!audience) {
      throw new OAuthProviderNotConfiguredError('APPLE');
    }

    let payload;
    try {
      payload = await verifyAgainstJwks({
        idToken,
        jwksUri: APPLE_JWKS_URI,
        issuer: APPLE_ISSUER,
        audience,
      });
    } catch {
      throw new OAuthTokenInvalidError('APPLE');
    }

    const providerId = payload['sub'];
    if (typeof providerId !== 'string') {
      throw new OAuthTokenInvalidError('APPLE');
    }

    return {
      providerId,
      email: typeof payload['email'] === 'string' ? payload['email'] : null,
      // Apple's own id tokens are always for a verified Apple Account email, but the claim comes
      // back as the string "true"/"false", not a real boolean — handled explicitly here.
      emailVerified: payload['email_verified'] === true || payload['email_verified'] === 'true',
      // Apple's id token never carries a name claim — the one-time fullName comes from the
      // native SDK response itself and is passed into the use case separately (see
      // sign-in-with-provider.usecase.ts), not from here.
      name: null,
    };
  }
}
