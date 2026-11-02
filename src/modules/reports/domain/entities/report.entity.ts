export type ReportTargetType = 'REVIEW' | 'MESSAGE';
export type ReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

export interface Report {
  readonly id: string;
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly reporterUserId: string;
  readonly reason: string;
  readonly status: ReportStatus;
  readonly resolvedByUserId: string | null;
  readonly resolvedAt: Date | null;
  readonly resolutionNote: string | null;
  readonly createdAt: Date;
}
