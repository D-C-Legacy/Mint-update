import { OAuthIdentity } from '../entities/oauth-identity.entity';

export const OAUTH_IDENTITY_REPOSITORY = Symbol('OAuthIdentityRepositoryPort');

export interface CreateOAuthIdentityInput {
  readonly id: string;
  readonly userId: string;
  readonly provider: OAuthIdentity['provider'];
  readonly providerId: string;
  readonly email: string | null;
}

export interface OAuthIdentityRepositoryPort {
  findByProviderIdentity(
    provider: OAuthIdentity['provider'],
    providerId: string,
  ): Promise<OAuthIdentity | null>;
  findByUserId(userId: string): Promise<OAuthIdentity[]>;
  create(input: CreateOAuthIdentityInput): Promise<OAuthIdentity>;
}
