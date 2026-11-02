import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  DateRange,
  SellerAnalyticsRepositoryPort,
} from '../../domain/ports/seller-analytics.repository.port';
import {
  SellerOrdersSummaryPoint,
  SellerStatusCount,
} from '../../domain/entities/seller-analytics.entity';

// Seller-scoped mirror of modules/admin's AnalyticsPrismaRepository — same `$queryRaw` +
// `date_trunc` shape (Prisma's query builder can't group by a date expression), same "every
// interpolated identifier here is a fixed string this file writes, never request data" safety
// note. `${sellerId}`/`${range.from}`/`${range.to}` ARE proper bound parameters, not raw text.
@Injectable()
export class SellerAnalyticsPrismaRepository implements SellerAnalyticsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  // 2d finding: `date_trunc('day', timestamptz)` truncates in the SESSION timezone — on a UTC
  // server (prod/CI) that is UTC-midnight buckets, on an IST-configured server it is IST-midnight
  // buckets, so day labels (and which orders fall in which day) silently differ per environment.
  // Pin the bucketing to UTC: `timestamptz AT TIME ZONE 'UTC'` yields naive UTC components, truncat-
  // ing those is unambiguous, and wrapping again restores a true UTC-midnight instant, so Prisma
  // deserializes an exact `…T00:00:00.000Z` regardless of the session's TimeZone setting.
  async ordersSummary(
    sellerId: string,
    range: DateRange,
  ): Promise<readonly SellerOrdersSummaryPoint[]> {
    return this.prisma.$queryRaw<SellerOrdersSummaryPoint[]>(Prisma.sql`
      SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS day,
             COUNT(*)::int AS "orderCount",
             COALESCE(SUM("totalAmount"), 0)::bigint AS revenue
      FROM "Order"
      WHERE "sellerId" = ${sellerId}
        AND status IN ('PAID', 'COMPLETED')
        AND "createdAt" >= ${range.from} AND "createdAt" < ${range.to}
      GROUP BY day
      ORDER BY day ASC
    `);
  }

  async ordersByStatus(sellerId: string): Promise<readonly SellerStatusCount[]> {
    const rows = await this.prisma.order.groupBy({
      by: ['status'],
      where: { sellerId },
      _count: { status: true },
    });
    return rows.map((row) => ({ status: row.status, count: row._count.status }));
  }
}
