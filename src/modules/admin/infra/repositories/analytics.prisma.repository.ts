import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { AnalyticsRepositoryPort, DateRange } from '../../domain/ports/analytics.repository.port';
import {
  OrdersSummaryPoint,
  PayoutStatusSummary,
  SellerApprovalPoint,
  SellersSummary,
  StatusCount,
} from '../../domain/entities/analytics.entity';

// Prisma's query builder can't `date_trunc` a column directly (no groupBy-by-expression support),
// so the day-bucketed queries go straight to `$queryRaw` — same precedent LedgerPrismaRepository
// already set (findUnbalancedTransactionIds' own comment). All identifiers interpolated via
// `Prisma.raw` below are fixed strings this file writes, never request data, so this is safe as
// parameterized raw SQL (`${range.from}`/`${range.to}` ARE proper bound parameters, not raw text).
@Injectable()
export class AnalyticsPrismaRepository implements AnalyticsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  // Shared shape every day-bucketed query here follows: one table, one date column, an optional
  // extra predicate, some aggregate select list. `selectSql`/`whereSql` are composed by each
  // caller from fixed, hand-written fragments — never from user input.
  private async bucketByDay<T extends { day: Date }>(
    tableName: string,
    dateColumn: string,
    selectSql: Prisma.Sql,
    whereSql: Prisma.Sql,
    range: DateRange,
  ): Promise<T[]> {
    const col = Prisma.raw(`"${dateColumn}"`);
    const table = Prisma.raw(`"${tableName}"`);
    return this.prisma.$queryRaw<T[]>(Prisma.sql`
      SELECT date_trunc('day', ${col}) AS day, ${selectSql}
      FROM ${table}
      WHERE ${whereSql} AND ${col} >= ${range.from} AND ${col} < ${range.to}
      GROUP BY day
      ORDER BY day ASC
    `);
  }

  async ordersSummary(range: DateRange): Promise<readonly OrdersSummaryPoint[]> {
    return this.bucketByDay<OrdersSummaryPoint>(
      'Order',
      'createdAt',
      Prisma.sql`COUNT(*)::int AS "orderCount", COALESCE(SUM("totalAmount"), 0)::bigint AS revenue`,
      Prisma.sql`status IN ('PAID', 'COMPLETED')`,
      range,
    );
  }

  async ordersByStatus(): Promise<readonly StatusCount[]> {
    const rows = await this.prisma.order.groupBy({ by: ['status'], _count: { status: true } });
    return rows.map((row) => ({ status: row.status, count: row._count.status }));
  }

  async sellersSummary(range: DateRange): Promise<SellersSummary> {
    const [byStatusRows, approvalsOverTime] = await Promise.all([
      this.prisma.seller.groupBy({ by: ['status'], _count: { status: true } }),
      this.bucketByDay<SellerApprovalPoint>(
        'Seller',
        'approvedAt',
        Prisma.sql`COUNT(*)::int AS "approvalCount"`,
        Prisma.sql`"approvedAt" IS NOT NULL`,
        range,
      ),
    ]);
    return {
      byStatus: byStatusRows.map((row) => ({ status: row.status, count: row._count.status })),
      approvalsOverTime,
    };
  }

  async payoutsSummary(): Promise<readonly PayoutStatusSummary[]> {
    const rows = await this.prisma.payout.groupBy({
      by: ['status'],
      _count: { status: true },
      _sum: { amount: true },
    });
    return rows.map((row) => ({
      status: row.status,
      count: row._count.status,
      totalAmount: row._sum.amount ?? 0n,
    }));
  }
}
