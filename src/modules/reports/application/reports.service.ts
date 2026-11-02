import { Inject, Injectable } from '@nestjs/common';
import { generateId } from '../../../shared/ids/id';
import { Result, Ok, Err } from '../../../shared/result/result';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../shared/pagination/cursor';
import { REPORT_REPOSITORY, ReportRepositoryPort } from '../domain/ports/report.repository.port';
import { Report, ReportStatus, ReportTargetType } from '../domain/entities/report.entity';
import { ReportNotFoundError } from '../domain/errors/reports.errors';

export interface CreateReportCommand {
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly reporterUserId: string;
  readonly reason: string;
}

export interface ListForAdminCommand {
  readonly status: ReportStatus | undefined;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

export interface ResolveReportCommand {
  readonly reportId: string;
  readonly resolvedByUserId: string;
  readonly status: 'RESOLVED' | 'DISMISSED';
  readonly note: string | null;
}

// Deliberately standalone — no import of reviews/messaging, so neither of those modules has to
// import this one back to create a report (avoids a circular DI graph). Target existence is not
// validated here (would need exactly that cross-module read); the admin moderation queue is the
// backstop that surfaces a report whose target turns out to be gone.
@Injectable()
export class ReportsService {
  constructor(@Inject(REPORT_REPOSITORY) private readonly reports: ReportRepositoryPort) {}

  async create(cmd: CreateReportCommand): Promise<Report> {
    return this.reports.create({ id: generateId(), ...cmd });
  }

  async listForAdmin(cmd: ListForAdminCommand): Promise<CursorPage<Report>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.reports.listForAdmin({ status: cmd.status, cursor: cmd.cursor, limit });
    return buildCursorPage(rows, limit);
  }

  async resolve(cmd: ResolveReportCommand): Promise<Result<Report, ReportNotFoundError>> {
    const updated = await this.reports.resolve(cmd.reportId, cmd.resolvedByUserId, cmd.status, cmd.note);
    if (!updated) {
      return Err(new ReportNotFoundError(cmd.reportId));
    }
    return Ok(updated);
  }
}
