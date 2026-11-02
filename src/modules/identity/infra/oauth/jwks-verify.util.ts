import jwt, { JwtPayload } from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

// One client per JWKS URI, reused across requests — jwks-rsa caches keys internally per client
// instance, so this avoids re-fetching Google's/Apple's public keys on every sign-in.
const clients = new Map<string, JwksClient>();

function getClient(jwksUri: string): JwksClient {
  let client = clients.get(jwksUri);
  if (!client) {
    client = new JwksClient({ jwksUri, cache: true, cacheMaxAge: 3600_000 });
    clients.set(jwksUri, client);
  }
  return client;
}

export interface VerifyAgainstJwksInput {
  readonly idToken: string;
  readonly jwksUri: string;
  readonly issuer: string | [string, ...string[]];
  readonly audience: string;
}

// Shared by google.verifier.ts and apple.verifier.ts — one RS256-against-published-JWKS
// verification path for both providers, instead of pulling in two different provider SDKs.
// Throws on any signature/issuer/audience/expiry mismatch; callers translate that into
// OAuthTokenInvalidError.
export async function verifyAgainstJwks(input: VerifyAgainstJwksInput): Promise<JwtPayload> {
  const decoded = jwt.decode(input.idToken, { complete: true });
  const kid = decoded?.header.kid;
  if (!decoded || typeof kid !== 'string') {
    throw new Error('Token has no usable "kid" header');
  }
  const signingKey = await getClient(input.jwksUri).getSigningKey(kid);
  const payload = jwt.verify(input.idToken, signingKey.getPublicKey(), {
    algorithms: ['RS256'],
    issuer: input.issuer,
    audience: input.audience,
  });
  if (typeof payload === 'string') {
    throw new Error('Unexpected string JWT payload');
  }
  return payload;
}
