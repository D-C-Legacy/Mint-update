export interface Channel {
  readonly id: string;
  readonly sellerId: string;
  readonly slug: string;
  readonly name: string;
  readonly bio: string | null;
  readonly bannerKey: string | null;
  readonly followerCount: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
}
