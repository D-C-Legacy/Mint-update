import type { User as PrismaUser } from '@prisma/client';
import { User } from '../../domain/entities/user.entity';

export function toDomainUser(row: PrismaUser): User {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    passwordHash: row.passwordHash,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    role: row.role,
    status: row.status,
    emailVerifiedAt: row.emailVerifiedAt,
    deletionRequestedAt: row.deletionRequestedAt,
    deletionScheduledAt: row.deletionScheduledAt,
  };
}
