// Read models for 05-API-SPEC.md §11 user management (GET /admin/users, GET /admin/users/:id).
// Lives in domain so AdminUserRepositoryPort can reference them without reaching into application/.
export type AdminUserPlatform = 'IOS' | 'ANDROID' | 'WEB' | 'UNKNOWN';

export interface AdminUserSummary {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly role: 'BUYER' | 'SELLER' | 'ADMIN';
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  readonly createdAt: string;
  readonly lastLoginAt: string | null;
  readonly primaryPlatform: AdminUserPlatform;
  readonly isSeller: boolean;
  readonly sellerStatus: string | null;
  // Apple App Store guideline 5.1.1(v) account-deletion feature (28 Oct 2026) — read-only per the
  // founder: admin can see a pending request, never force or cancel one.
  readonly deletionScheduledAt: string | null;
}

export interface AdminUserDetail {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly role: 'BUYER' | 'SELLER' | 'ADMIN';
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  readonly emailVerifiedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastLoginAt: string | null;
  readonly devices: readonly {
    id: string;
    platform: 'IOS' | 'ANDROID' | 'WEB';
    lastSeenAt: string;
  }[];
  readonly primaryPlatform: AdminUserPlatform;
  readonly seller: {
    id: string;
    status: string;
    displayName: string;
    type: 'INDIVIDUAL' | 'BUSINESS';
  } | null;
  readonly addresses: readonly {
    id: string;
    city: string;
    region: string;
    countryCode: string;
    isDefault: boolean;
  }[];
  readonly paymentCustomer: { userId: string; providerCustomerId: string } | null;
  readonly teamMemberships: readonly { id: string; sellerId: string; role: string }[];
  readonly orderCount: number;
  readonly addressCount: number;
  readonly deletionRequestedAt: string | null;
  readonly deletionScheduledAt: string | null;
}
