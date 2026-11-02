export interface AuditLog {
  readonly id: string;
  readonly actorUserId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
  readonly reason: string | null;
  readonly ipAddress: string | null;
  readonly createdAt: Date;
}
