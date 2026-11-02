export type DevicePlatform = 'IOS' | 'ANDROID' | 'WEB';

export interface Device {
  readonly id: string;
  readonly userId: string;
  readonly pushToken: string;
  readonly platform: DevicePlatform;
  readonly lastSeenAt: Date;
  readonly createdAt: Date;
}
