import { Device, DevicePlatform } from '../entities/device.entity';

export const DEVICE_REPOSITORY = Symbol('DeviceRepositoryPort');

export interface RegisterDeviceInput {
  readonly id: string;
  readonly userId: string;
  readonly pushToken: string;
  readonly platform: DevicePlatform;
  readonly seenAt: Date;
}

export interface DeviceRepositoryPort {
  findByUserId(userId: string): Promise<Device[]>;
  // Keyed on the push token (unique): re-registering refreshes it, and a token that was held by
  // another account moves to this one (the phone changed hands or the user signed in elsewhere).
  upsertByPushToken(input: RegisterDeviceInput): Promise<Device>;
  // Only deletes a device owned by `userId`. Returns whether a row was removed.
  deleteOwned(id: string, userId: string): Promise<boolean>;
}
