import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { DEVICE_REPOSITORY, DeviceRepositoryPort } from '../../domain/ports/device.repository.port';
import { DeviceNotFoundError } from '../../domain/errors/identity.errors';

export interface RemoveDeviceCommand {
  readonly userId: string;
  readonly deviceId: string;
}

// `DELETE /me/devices/:id` (05-API-SPEC.md §2). Someone else's device id looks the same as a
// missing one, so ids cannot be probed.
@Injectable()
export class RemoveDeviceUseCase {
  constructor(@Inject(DEVICE_REPOSITORY) private readonly devices: DeviceRepositoryPort) {}

  async execute(cmd: RemoveDeviceCommand): Promise<Result<{ removed: true }, DeviceNotFoundError>> {
    const removed = await this.devices.deleteOwned(cmd.deviceId, cmd.userId);
    return removed ? Ok({ removed: true }) : Err(new DeviceNotFoundError(cmd.deviceId));
  }
}
