import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateSessionInput,
  SessionRecord,
  SessionRepositoryPort,
} from '../../domain/ports/session.repository.port';

@Injectable()
export class SessionPrismaRepository implements SessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSessionInput): Promise<SessionRecord> {
    const row = await this.prisma.session.create({
      data: {
        id: input.id,
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
        ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
        ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
      },
    });
    return row;
  }

  async findByRefreshTokenHash(hash: string): Promise<SessionRecord | null> {
    return this.prisma.session.findUnique({ where: { refreshTokenHash: hash } });
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.prisma.session.update({ where: { id }, data: { revokedAt } });
  }

  async revokeFamily(familyId: string, revokedAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt },
    });
  }

  async revokeAllForUser(userId: string, revokedAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
  }
}
