import type { Device as PrismaDevice } from '@prisma/client';
import { Device } from '../../domain/entities/device.entity';

export function toDomainDevice(row: PrismaDevice): Device {
  return {
    id: row.id,
    userId: row.userId,
    pushToken: row.pushToken,
    platform: row.platform,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
  };
}
