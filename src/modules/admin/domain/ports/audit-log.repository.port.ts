import { AuditLog } from '../entities/audit-log.entity';

export const AUDIT_LOG_REPOSITORY = Symbol('AuditLogRepositoryPort');

export interface CreateAuditLogInput {
  readonly id: string;
  readonly actorUserId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly before: Record<string, unknown> | undefined;
  readonly after: Record<string, unknown> | undefined;
  readonly reason: string | undefined;
  readonly ipAddress: string | undefined;
}

export interface ListAuditLogFilter {
  // No doc specifies which fields "filterable" (05-API-SPEC.md §11's `GET /admin/audit-log`)
  // means — actorUserId/targetType are the two most useful cuts for an admin reviewing the
  // trail, same reasoned-default treatment as every other underspecified filter in this build.
  readonly actorUserId: string | undefined;
  readonly targetType: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface AuditLogRepositoryPort {
  create(input: CreateAuditLogInput): Promise<AuditLog>;
  list(filter: ListAuditLogFilter): Promise<AuditLog[]>;
}
