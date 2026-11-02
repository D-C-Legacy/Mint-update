import jwt from 'jsonwebtoken';
import { oauthConfig } from '../../../../config/oauth.config';
import { OAuthProviderNotConfiguredError } from '../../domain/errors/identity.errors';

// Apple's web/server OAuth flow has no static client secret — the token endpoint expects a
// short-lived ES256 JWT signed with the app's own private key instead. Built fresh per
// authorization-code exchange (apple-oauth.controller.ts), not cached, since a 5-minute TTL
// means there is nothing worth caching.
export function buildAppleClientSecret(): string {
  const { teamId, keyId, privateKey, servicesId } = oauthConfig.apple;
  if (!teamId || !keyId || !privateKey || !servicesId) {
    throw new OAuthProviderNotConfiguredError('APPLE');
  }
  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '5m',
    issuer: teamId,
    audience: 'https://appleid.apple.com',
    subject: servicesId,
    keyid: keyId,
  });
}
