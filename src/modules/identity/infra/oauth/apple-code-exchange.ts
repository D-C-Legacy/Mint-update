import { Injectable } from '@nestjs/common';
import { oauthConfig } from '../../../../config/oauth.config';
import { OAuthCodeExchangerPort } from '../../application/ports/oauth-code-exchanger.port';
import {
  OAuthProviderNotConfiguredError,
  OAuthTokenInvalidError,
} from '../../domain/errors/identity.errors';
import { buildAppleClientSecret } from './apple-client-secret';

const APPLE_TOKEN_ENDPOINT = 'https://appleid.apple.com/auth/token';

@Injectable()
export class AppleOAuthCodeExchanger implements OAuthCodeExchangerPort {
  async exchange(code: string): Promise<{ idToken: string }> {
    const { servicesId, redirectUri } = oauthConfig.apple;
    if (!servicesId || !redirectUri) {
      throw new OAuthProviderNotConfiguredError('APPLE');
    }
    // Throws OAuthProviderNotConfiguredError itself if team/key/private key are missing.
    const clientSecret = buildAppleClientSecret();

    const res = await fetch(APPLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: servicesId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!res.ok) {
      throw new OAuthTokenInvalidError('APPLE');
    }
    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) {
      throw new OAuthTokenInvalidError('APPLE');
    }
    return { idToken: body.id_token };
  }
}
