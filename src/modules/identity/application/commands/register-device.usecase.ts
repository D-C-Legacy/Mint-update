import { Inject, Injectable } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { CLOCK, Clock } from '../../../../shared/time/clock';
import { DEVICE_REPOSITORY, DeviceRepositoryPort } from '../../domain/ports/device.repository.port';
import { Device, DevicePlatform } from '../../domain/entities/device.entity';

export interface RegisterDeviceCommand {
  readonly userId: string;
  readonly pushToken: string;
  readonly platform: DevicePlatform;
}

// `POST /me/devices` (05-API-SPEC.md §2). Idempotent: the same token registers once and just
// refreshes `lastSeenAt` on every later call.
@Injectable()
export class RegisterDeviceUseCase {
  constructor(
    @Inject(DEVICE_REPOSITORY) private readonly devices: DeviceRepositoryPort,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: RegisterDeviceCommand): Promise<Device> {
    return this.devices.upsertByPushToken({
      id: generateId(),
      userId: cmd.userId,
      pushToken: cmd.pushToken,
      platform: cmd.platform,
      seenAt: this.clock.now(),
    });
  }
}
