import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateOAuthIdentityInput,
  OAuthIdentityRepositoryPort,
} from '../../domain/ports/oauth-identity.repository.port';
import { OAuthIdentity, OAuthProviderName } from '../../domain/entities/oauth-identity.entity';
import { toDomainOAuthIdentity } from '../mappers/oauth-identity.mapper';

@Injectable()
export class OAuthIdentityPrismaRepository implements OAuthIdentityRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByProviderIdentity(
    provider: OAuthProviderName,
    providerId: string,
  ): Promise<OAuthIdentity | null> {
    const row = await this.prisma.oAuthIdentity.findUnique({
      where: { provider_providerId: { provider, providerId } },
    });
    return row ? toDomainOAuthIdentity(row) : null;
  }

  async findByUserId(userId: string): Promise<OAuthIdentity[]> {
    const rows = await this.prisma.oAuthIdentity.findMany({ where: { userId } });
    return rows.map(toDomainOAuthIdentity);
  }

  async create(input: CreateOAuthIdentityInput): Promise<OAuthIdentity> {
    const row = await this.prisma.oAuthIdentity.create({
      data: {
        id: input.id,
        userId: input.userId,
        provider: input.provider,
        providerId: input.providerId,
        email: input.email,
      },
    });
    return toDomainOAuthIdentity(row);
  }
}
