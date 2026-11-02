import { Report, ReportStatus, ReportTargetType } from '../entities/report.entity';

export const REPORT_REPOSITORY = Symbol('ReportRepositoryPort');

export interface CreateReportInput {
  readonly id: string;
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly reporterUserId: string;
  readonly reason: string;
}

export interface ListForAdminFilter {
  readonly status: ReportStatus | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface ReportRepositoryPort {
  create(input: CreateReportInput): Promise<Report>;
  findById(id: string): Promise<Report | null>;
  resolve(id: string, resolvedByUserId: string, status: 'RESOLVED' | 'DISMISSED', note: string | null): Promise<Report | null>;
  listForAdmin(filter: ListForAdminFilter): Promise<Report[]>;
}
