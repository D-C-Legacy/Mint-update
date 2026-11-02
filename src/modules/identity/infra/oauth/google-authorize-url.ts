import { oauthConfig } from '../../../../config/oauth.config';

const GOOGLE_AUTHORIZE_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

// null means "not configured yet" — the controller turns that into a clean
// OAuthProviderNotConfiguredError rather than redirecting anywhere.
export function buildGoogleAuthorizeUrl(state: string): string | null {
  const { webClientId, webRedirectUri } = oauthConfig.google;
  if (!webClientId || !webRedirectUri) return null;

  const params = new URLSearchParams({
    client_id: webClientId,
    redirect_uri: webRedirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTHORIZE_ENDPOINT}?${params.toString()}`;
}
