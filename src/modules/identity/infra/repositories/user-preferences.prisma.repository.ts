import { Injectable } from '@nestjs/common';
import type { UserPreference } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { UserPreferencesRepositoryPort } from '../../domain/ports/user-preferences.repository.port';
import { UserPreferences, UserPreferencesPatch } from '../../domain/entities/user-preferences.entity';

function toDomain(row: UserPreference): UserPreferences {
  return {
    notifications: {
      live: row.notifyLive,
      bids: row.notifyBids,
      orders: row.notifyOrders,
      messages: row.notifyMessages,
    },
    privacy: {
      publicProfile: row.privacyPublicProfile,
      showActivity: row.privacyShowActivity,
      onlineStatus: row.privacyOnlineStatus,
    },
  };
}

// Maps only the fields the patch actually carries; a missing key leaves its column untouched.
function toColumns(patch: UserPreferencesPatch): Partial<Omit<UserPreference, 'userId' | 'updatedAt'>> {
  const entries = [
    ['notifyLive', patch.notifications?.live],
    ['notifyBids', patch.notifications?.bids],
    ['notifyOrders', patch.notifications?.orders],
    ['notifyMessages', patch.notifications?.messages],
    ['privacyPublicProfile', patch.privacy?.publicProfile],
    ['privacyShowActivity', patch.privacy?.showActivity],
    ['privacyOnlineStatus', patch.privacy?.onlineStatus],
  ] as const;
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

@Injectable()
export class UserPreferencesPrismaRepository implements UserPreferencesRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<UserPreferences | null> {
    const row = await this.prisma.userPreference.findUnique({ where: { userId } });
    return row ? toDomain(row) : null;
  }

  async upsert(userId: string, patch: UserPreferencesPatch): Promise<UserPreferences> {
    const columns = toColumns(patch);
    const row = await this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...columns },
      update: columns,
    });
    return toDomain(row);
  }
}
