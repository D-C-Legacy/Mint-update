import { Inject, Injectable } from '@nestjs/common';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { AUDIT_LOG_REPOSITORY, AuditLogRepositoryPort } from '../../domain/ports/audit-log.repository.port';
import { AuditLog } from '../../domain/entities/audit-log.entity';

export interface ListAuditLogCommand {
  readonly actorUserId: string | undefined;
  readonly targetType: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// `GET /admin/audit-log` (05-API-SPEC.md §11, "Audit trail, filterable") — unowned since P2-06.
@Injectable()
export class ListAuditLogQuery {
  constructor(@Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogs: AuditLogRepositoryPort) {}

  async execute(cmd: ListAuditLogCommand): Promise<CursorPage<AuditLog>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.auditLogs.list({
      actorUserId: cmd.actorUserId,
      targetType: cmd.targetType,
      cursor: cmd.cursor,
      limit,
    });
    return buildCursorPage(rows, limit);
  }
}
