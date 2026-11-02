import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { DeviceRepositoryPort, RegisterDeviceInput } from '../../domain/ports/device.repository.port';
import { Device } from '../../domain/entities/device.entity';
import { toDomainDevice } from '../mappers/device.mapper';

@Injectable()
export class DevicePrismaRepository implements DeviceRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<Device[]> {
    const rows = await this.prisma.device.findMany({ where: { userId } });
    return rows.map(toDomainDevice);
  }

  async upsertByPushToken(input: RegisterDeviceInput): Promise<Device> {
    const row = await this.prisma.device.upsert({
      where: { pushToken: input.pushToken },
      create: {
        id: input.id,
        userId: input.userId,
        pushToken: input.pushToken,
        platform: input.platform,
        lastSeenAt: input.seenAt,
      },
      update: { userId: input.userId, platform: input.platform, lastSeenAt: input.seenAt },
    });
    return toDomainDevice(row);
  }

  async deleteOwned(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.device.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }
}
