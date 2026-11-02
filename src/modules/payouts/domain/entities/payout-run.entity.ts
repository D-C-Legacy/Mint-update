export type PayoutRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface PayoutRun {
  readonly id: string;
  readonly status: PayoutRunStatus;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly totalAmount: bigint;
  readonly payoutCount: number;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
}
