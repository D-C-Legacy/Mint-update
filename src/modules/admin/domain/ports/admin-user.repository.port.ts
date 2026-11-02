import { CursorPage } from '../../../../shared/pagination/cursor';
import {
  AdminUserDetail,
  AdminUserPlatform,
  AdminUserSummary,
} from '../entities/admin-user.entity';

export const ADMIN_USER_REPOSITORY = Symbol('AdminUserRepositoryPort');

export interface ListAdminUsersFilter {
  readonly q: string | undefined;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'DELETED' | undefined;
  readonly platform: AdminUserPlatform | undefined;
  readonly role: 'BUYER' | 'SELLER' | 'ADMIN' | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface AdminUserRepositoryPort {
  list(filter: ListAdminUsersFilter): Promise<CursorPage<AdminUserSummary>>;
  getDetail(userId: string): Promise<AdminUserDetail | null>;
  // Deliberately still just ACTIVE|SUSPENDED — DELETED is only ever reached by
  // ExecuteAccountDeletionUseCase (modules/identity), never by admin. Per the founder: account
  // deletion is a user-only decision, admin gets read-only visibility (see deletionScheduledAt
  // on AdminUserSummary/Detail), no force-delete action.
  updateStatus(
    userId: string,
    status: 'ACTIVE' | 'SUSPENDED',
  ): Promise<{ id: string; status: string }>;
}
