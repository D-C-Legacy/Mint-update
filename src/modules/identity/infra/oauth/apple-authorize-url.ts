import { oauthConfig } from '../../../../config/oauth.config';

const APPLE_AUTHORIZE_ENDPOINT = 'https://appleid.apple.com/auth/authorize';

// null means "not configured yet" — the controller turns that into a clean
// OAuthProviderNotConfiguredError rather than redirecting anywhere.
export function buildAppleAuthorizeUrl(state: string): string | null {
  const { servicesId, redirectUri } = oauthConfig.apple;
  if (!servicesId || !redirectUri) return null;

  const params = new URLSearchParams({
    client_id: servicesId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'name email',
    // Mandatory once name/email scopes are requested — Apple POSTs the result to
    // POST /auth/apple/callback instead of a GET-with-query-string redirect.
    response_mode: 'form_post',
    state,
  });
  return `${APPLE_AUTHORIZE_ENDPOINT}?${params.toString()}`;
}
