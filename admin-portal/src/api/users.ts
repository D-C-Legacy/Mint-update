// Typed wrappers around the admin user-management routes (05-API-SPEC.md §11, Phase C).
// Shapes mirror the backend exactly (src/modules/admin/domain/entities/admin-user.entity.ts)
// — kept in step by hand, not generated.
import { apiClient } from '../auth/AuthContext';
import type { CursorPage } from './applications';

export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED' | 'UNKNOWN';
export type UserPlatform = 'IOS' | 'ANDROID' | 'WEB' | 'UNKNOWN';

// Primary platform is derived (no column on User): the most-recently-seen device's platform,
// UNKNOWN when the user has no devices. iOS/Android/Web filters mean "has a device of that
// platform"; Unknown means "has none".
export type ListUsersParams = {
  q?: string;
  status?: Exclude<UserStatus, 'UNKNOWN'>;
  platform?: UserPlatform;
  role?: UserRole;
  cursor?: string;
  limit?: number;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  lastLoginAt: string | null;
  primaryPlatform: UserPlatform;
  isSeller: boolean;
  sellerStatus: string | null;
  // Apple App Store guideline 5.1.1(v) account-deletion feature (28 Oct 2026) — read-only: no
  // admin action sets or clears this, it's the user's own pending request.
  deletionScheduledAt: string | null;
};

export function listUsers(params: ListUsersParams): Promise<CursorPage<AdminUserSummary>> {
  return apiClient.request('/admin/users', {
    query: {
      q: params.q,
      status: params.status,
      platform: params.platform,
      role: params.role,
      cursor: params.cursor,
      limit: params.limit ?? 20,
    },
  });
}

export function suspendUser(userId: string): Promise<{ id: string; status: UserStatus }> {
  return apiClient.request(`/admin/users/${userId}/suspend`, { method: 'POST' });
}

export function reinstateUser(userId: string): Promise<{ id: string; status: UserStatus }> {
  return apiClient.request(`/admin/users/${userId}/reinstate`, { method: 'POST' });
}
