import { Injectable } from '@nestjs/common';
import { oauthConfig } from '../../../../config/oauth.config';
import { OAuthCodeExchangerPort } from '../../application/ports/oauth-code-exchanger.port';
import {
  OAuthProviderNotConfiguredError,
  OAuthTokenInvalidError,
} from '../../domain/errors/identity.errors';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

@Injectable()
export class GoogleOAuthCodeExchanger implements OAuthCodeExchangerPort {
  async exchange(code: string): Promise<{ idToken: string }> {
    const { webClientId, webClientSecret, webRedirectUri } = oauthConfig.google;
    if (!webClientId || !webClientSecret || !webRedirectUri) {
      throw new OAuthProviderNotConfiguredError('GOOGLE');
    }

    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: webClientId,
        client_secret: webClientSecret,
        redirect_uri: webRedirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!res.ok) {
      throw new OAuthTokenInvalidError('GOOGLE');
    }
    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) {
      throw new OAuthTokenInvalidError('GOOGLE');
    }
    return { idToken: body.id_token };
  }
}
