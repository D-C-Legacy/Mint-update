import { Inject, Injectable } from '@nestjs/common';
import { DEVICE_REPOSITORY, DeviceRepositoryPort } from '../../domain/ports/device.repository.port';

export interface GetDeviceTokensCommand {
  readonly userId: string;
}

// Added for P8-04: the PUSH half of every notification handler needs a user's registered push
// tokens. Returns raw tokens only (not full Device rows) — the one thing PushChannelPort's
// `recipient` needs; callers that need platform/lastSeenAt should go through the repository
// directly rather than widening this query's return shape for a need that doesn't exist yet.
@Injectable()
export class GetDeviceTokensQuery {
  constructor(@Inject(DEVICE_REPOSITORY) private readonly devices: DeviceRepositoryPort) {}

  async execute(cmd: GetDeviceTokensCommand): Promise<string[]> {
    const devices = await this.devices.findByUserId(cmd.userId);
    return devices.map((device) => device.pushToken);
  }
}
