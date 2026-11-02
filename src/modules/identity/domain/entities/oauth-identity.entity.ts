export type OAuthProviderName = 'GOOGLE' | 'APPLE';

export interface OAuthIdentity {
  readonly id: string;
  readonly userId: string;
  readonly provider: OAuthProviderName;
  readonly providerId: string;
  readonly email: string | null;
  readonly createdAt: Date;
}
