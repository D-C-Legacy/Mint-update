import type { OAuthIdentity as PrismaOAuthIdentity } from '@prisma/client';
import { OAuthIdentity } from '../../domain/entities/oauth-identity.entity';

export function toDomainOAuthIdentity(row: PrismaOAuthIdentity): OAuthIdentity {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    providerId: row.providerId,
    email: row.email,
    createdAt: row.createdAt,
  };
}
