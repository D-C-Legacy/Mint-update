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

const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS: [string, string] = ['https://accounts.google.com', 'accounts.google.com'];

@Injectable()
export class GoogleOAuthVerifier implements OAuthVerifierPort {
  async verify(idToken: string, context: OAuthVerifyContext): Promise<VerifiedOAuthClaims> {
    const { webClientId, iosClientId } = oauthConfig.google;
    const audience = context === 'web' ? webClientId : iosClientId;
    if (!audience) {
      throw new OAuthProviderNotConfiguredError('GOOGLE');
    }

    let payload;
    try {
      payload = await verifyAgainstJwks({
        idToken,
        jwksUri: GOOGLE_JWKS_URI,
        issuer: GOOGLE_ISSUERS,
        audience,
      });
    } catch {
      throw new OAuthTokenInvalidError('GOOGLE');
    }

    const providerId = payload['sub'];
    if (typeof providerId !== 'string') {
      throw new OAuthTokenInvalidError('GOOGLE');
    }

    return {
      providerId,
      email: typeof payload['email'] === 'string' ? payload['email'] : null,
      // Google sends this as a real boolean on the id_token (unlike some other OIDC providers
      // that stringify it), but coerced defensively since it's not part of the signed structure
      // jsonwebtoken itself validates.
      emailVerified: payload['email_verified'] === true,
      name: typeof payload['name'] === 'string' ? payload['name'] : null,
    };
  }
}
