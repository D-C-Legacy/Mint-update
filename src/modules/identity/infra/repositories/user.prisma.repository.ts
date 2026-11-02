import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { CreateUserInput, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import { User } from '../../domain/entities/user.entity';
import { toDomainUser } from '../mappers/user.mapper';

@Injectable()
export class UserPrismaRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? toDomainUser(row) : null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { phone } });
    return row ? toDomainUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? toDomainUser(row) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const row = await this.prisma.user.create({
      data: {
        id: input.id,
        email: input.email,
        passwordHash: input.passwordHash ?? null,
        displayName: input.displayName,
        ...(input.emailVerifiedAt !== undefined ? { emailVerifiedAt: input.emailVerifiedAt } : {}),
      },
    });
    return toDomainUser(row);
  }

  async markEmailVerified(id: string, verifiedAt: Date): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { emailVerifiedAt: verifiedAt } });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async updateDisplayName(id: string, displayName: string): Promise<User> {
    const row = await this.prisma.user.update({ where: { id }, data: { displayName } });
    return toDomainUser(row);
  }

  async updateAvatarUrl(id: string, avatarUrl: string | null): Promise<User> {
    const row = await this.prisma.user.update({ where: { id }, data: { avatarUrl } });
    return toDomainUser(row);
  }

  async updatePhone(id: string, phone: string | null): Promise<User> {
    const row = await this.prisma.user.update({ where: { id }, data: { phone } });
    return toDomainUser(row);
  }

  async updateEmail(id: string, email: string, verifiedAt: Date): Promise<User> {
    const row = await this.prisma.user.update({
      where: { id },
      data: { email, emailVerifiedAt: verifiedAt },
    });
    return toDomainUser(row);
  }

  async scheduleDeletion(id: string, requestedAt: Date, scheduledAt: Date): Promise<User> {
    const row = await this.prisma.user.update({
      where: { id },
      data: { deletionRequestedAt: requestedAt, deletionScheduledAt: scheduledAt },
    });
    return toDomainUser(row);
  }

  async cancelDeletion(id: string): Promise<User> {
    const row = await this.prisma.user.update({
      where: { id },
      data: { deletionRequestedAt: null, deletionScheduledAt: null },
    });
    return toDomainUser(row);
  }

  async findDueForDeletion(before: Date, limit: number): Promise<readonly User[]> {
    const rows = await this.prisma.user.findMany({
      where: { deletionScheduledAt: { lte: before }, status: { not: 'DELETED' } },
      take: limit,
    });
    return rows.map(toDomainUser);
  }

  async executeDeletion(
    id: string,
    anonymizedEmail: string,
    anonymizedDisplayName: string,
  ): Promise<User> {
    const [, , , , , row] = await this.prisma.$transaction([
      this.prisma.session.deleteMany({ where: { userId: id } }),
      this.prisma.device.deleteMany({ where: { userId: id } }),
      this.prisma.oAuthIdentity.deleteMany({ where: { userId: id } }),
      this.prisma.userPreference.deleteMany({ where: { userId: id } }),
      this.prisma.userAddress.deleteMany({ where: { userId: id } }),
      this.prisma.user.update({
        where: { id },
        data: {
          email: anonymizedEmail,
          phone: null,
          passwordHash: null,
          displayName: anonymizedDisplayName,
          avatarUrl: null,
          status: 'DELETED',
          deletionRequestedAt: null,
          deletionScheduledAt: null,
        },
      }),
    ]);
    return toDomainUser(row);
  }
}
