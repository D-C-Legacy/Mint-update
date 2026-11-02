import { Injectable, Inject } from '@nestjs/common';
import { generateId } from '../../../shared/ids/id';
import { CursorPage, normalizeLimit } from '../../../shared/pagination/cursor';
import { Result, Ok, Err } from '../../../shared/result/result';
import {
  AUDIT_LOG_REPOSITORY,
  AuditLogRepositoryPort,
} from '../domain/ports/audit-log.repository.port';
import { AuditLog } from '../domain/entities/audit-log.entity';
import { ListAuditLogQuery, ListAuditLogCommand } from './queries/list-audit-log.query';
import { GetOrdersSummaryQuery, GetOrdersSummaryCommand } from './queries/get-orders-summary.query';
import { GetOrdersByStatusQuery } from './queries/get-orders-by-status.query';
import {
  GetSellersSummaryQuery,
  GetSellersSummaryCommand,
} from './queries/get-sellers-summary.query';
import { GetPayoutsSummaryQuery } from './queries/get-payouts-summary.query';
import {
  OrdersSummaryPoint,
  PayoutStatusSummary,
  SellersSummary,
  StatusCount,
} from '../domain/entities/analytics.entity';
import { SellersService } from '../../sellers/application/sellers.service';
import { SellerApplicationSummary } from '../../sellers/domain/entities/seller-application-summary.entity';
import { SellerApplicationNotFoundError } from '../../sellers/domain/errors/sellers.errors';
import { OrdersService } from '../../orders/application/orders.service';
import { Order, OrderStatus } from '../../orders/domain/entities/order.entity';
import {
  OrderNotFoundError,
  InvalidOrderStatusError,
} from '../../orders/domain/errors/orders.errors';
import { PayoutsService } from '../../payouts/application/payouts.service';
import { Payout, PayoutStatus } from '../../payouts/domain/entities/payout.entity';
import { PayoutRun } from '../../payouts/domain/entities/payout-run.entity';
import {
  PayoutNotFoundError,
  InvalidPayoutStatusError,
} from '../../payouts/domain/errors/payouts.errors';
import { RunPayoutResult } from '../../payouts/application/commands/run-payout.usecase';
import { LedgerService, ReconciliationReport } from '../../ledger/application/ledger.service';
import { PaymentsService } from '../../payments/application/payments.service';
import {
  OrderNotFoundError as PaymentOrderNotFoundError,
  PaymentNotFoundError,
  PaymentNotSucceededError,
  RefundExceedsRemainingError,
} from '../../payments/domain/errors/payments.errors';
import { StreamingService } from '../../streaming/application/streaming.service';
import { StreamSession } from '../../streaming/domain/entities/stream-session.entity';
import {
  StreamSessionNotFoundError,
  InvalidStreamStatusError,
} from '../../streaming/domain/errors/streaming.errors';
import {
  ADMIN_USER_REPOSITORY,
  AdminUserRepositoryPort,
  ListAdminUsersFilter,
} from '../domain/ports/admin-user.repository.port';
import { AdminUserDetail, AdminUserSummary } from '../domain/entities/admin-user.entity';

export interface RecordAuditLogInput {
  readonly actorUserId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly before?: Record<string, unknown>;
  readonly after?: Record<string, unknown>;
  readonly reason?: string;
  readonly ipAddress?: string;
}

export interface AdminQueuePageCommand {
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

export interface ListOrdersCommand extends AdminQueuePageCommand {
  readonly status: OrderStatus | undefined;
}

export interface ListPayoutsCommand extends AdminQueuePageCommand {
  readonly status: PayoutStatus;
}

export interface ListUsersCommand extends AdminQueuePageCommand {
  readonly q: string | undefined;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'DELETED' | undefined;
  readonly platform: 'IOS' | 'ANDROID' | 'WEB' | 'UNKNOWN' | undefined;
  readonly role: 'BUYER' | 'SELLER' | 'ADMIN' | undefined;
  readonly hasSupportTickets: boolean | undefined;
  readonly supportCategory: 'BILLING' | 'STREAMING' | 'ORDERS' | 'ACCOUNT' | 'OTHER' | undefined;
}

export type { AdminUserSummary, AdminUserDetail } from '../domain/entities/admin-user.entity';

export interface RefundOrderCommand {
  readonly orderId: string;
  readonly initiatedByUserId: string;
  readonly amount: bigint;
  readonly reason: string;
}

export interface ForceDeliverCommand {
  readonly orderId: string;
}

export interface GetOrderDetailCommand {
  readonly orderId: string;
}

export interface HoldPayoutCommand {
  readonly payoutId: string;
}

export interface KillStreamCommand {
  readonly sessionId: string;
}

export interface UpdateCommissionCommand {
  readonly sellerId: string;
  readonly commissionBps: number;
}

// 07-IMPLEMENTATION-PLAN.md's P8-05 deliverable: "queues and dashboards." AdminService is the
// single facade P8-06's controller calls for all 4 — each method just delegates to the module
// that actually owns the data (same cross-module read pattern as every prior ticket's facade
// additions), keeping Prisma/other-module internals out of modules/admin entirely per AGENTS.md
// §4. "Disputed orders" and "failed/held payouts" needed brand-new query methods added to
// OrdersService/PayoutsService in this same ticket — neither existed before (confirmed: neither
// service had any status-filtered list method at all, only single-row lookups).
@Injectable()
export class AdminService {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogs: AuditLogRepositoryPort,
    private readonly listAuditLogQuery: ListAuditLogQuery,
    private readonly getOrdersSummaryQuery: GetOrdersSummaryQuery,
    private readonly getOrdersByStatusQuery: GetOrdersByStatusQuery,
    private readonly getSellersSummaryQuery: GetSellersSummaryQuery,
    private readonly getPayoutsSummaryQuery: GetPayoutsSummaryQuery,
    private readonly sellers: SellersService,
    private readonly orders: OrdersService,
    private readonly payouts: PayoutsService,
    private readonly payments: PaymentsService,
    private readonly ledger: LedgerService,
    private readonly streaming: StreamingService,
    @Inject(ADMIN_USER_REPOSITORY) private readonly adminUsers: AdminUserRepositoryPort,
  ) {}

  async recordAuditLog(input: RecordAuditLogInput): Promise<AuditLog> {
    return this.auditLogs.create({
      id: generateId(),
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      before: input.before,
      after: input.after,
      reason: input.reason,
      ipAddress: input.ipAddress,
    });
  }

  async listPendingApplications(
    cmd: AdminQueuePageCommand,
  ): Promise<Result<CursorPage<SellerApplicationSummary>, never>> {
    return this.sellers.listApplications({ decision: 'PENDING', ...cmd });
  }

  async listDisputedOrders(cmd: AdminQueuePageCommand): Promise<CursorPage<Order>> {
    return this.orders.listDisputedOrders(cmd);
  }

  async listFailedPayouts(cmd: AdminQueuePageCommand): Promise<CursorPage<Payout>> {
    return this.payouts.listFailedPayouts(cmd);
  }

  async listHeldPayouts(cmd: AdminQueuePageCommand): Promise<CursorPage<Payout>> {
    return this.payouts.listHeldPayouts(cmd);
  }

  // Remaining 05-API-SPEC.md §11 routes, all unowned until P8-06.

  async updateCommission(
    cmd: UpdateCommissionCommand,
  ): Promise<Result<{ sellerId: string; commissionBps: number }, SellerApplicationNotFoundError>> {
    return this.sellers.updateCommission(cmd);
  }

  async listOrders(cmd: ListOrdersCommand): Promise<CursorPage<Order>> {
    return this.orders.listOrders(cmd);
  }

  // GET /orders/:id is buyer-ownership-scoped and would 404 an admin viewing someone else's
  // order — OrdersService.getOrder() has no such scoping, exactly what admin needs. The query
  // itself returns a plain nullable (not a Result), so the not-found case is wrapped here to
  // match this controller's toHttpException(result.error) pattern.
  async getOrder(cmd: GetOrderDetailCommand): Promise<Result<Order, OrderNotFoundError>> {
    const order = await this.orders.getOrder({ orderId: cmd.orderId });
    if (!order) return Err(new OrderNotFoundError(cmd.orderId));
    return Ok(order);
  }

  async refundOrder(
    cmd: RefundOrderCommand,
  ): Promise<
    Result<
      { refundId: string; paymentStatus: string; orderStatus: string },
      | PaymentOrderNotFoundError
      | PaymentNotFoundError
      | PaymentNotSucceededError
      | RefundExceedsRemainingError
    >
  > {
    return this.payments.refundPayment(cmd);
  }

  async forceDeliver(
    cmd: ForceDeliverCommand,
  ): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    return this.orders.confirmDelivery({ orderId: cmd.orderId, source: 'ADMIN' });
  }

  async listPayoutRuns(cmd: AdminQueuePageCommand): Promise<CursorPage<PayoutRun>> {
    return this.payouts.listRuns(cmd);
  }

  async listPayouts(cmd: ListPayoutsCommand): Promise<CursorPage<Payout>> {
    return this.payouts.listPayouts(cmd);
  }

  async triggerPayoutRun(): Promise<RunPayoutResult> {
    return this.payouts.runPayout();
  }

  async holdPayout(
    cmd: HoldPayoutCommand,
  ): Promise<Result<Payout, PayoutNotFoundError | InvalidPayoutStatusError>> {
    return this.payouts.holdPayout(cmd);
  }

  async getReconciliationReport(): Promise<ReconciliationReport> {
    return this.ledger.getReconciliationReport();
  }

  async killStream(
    cmd: KillStreamCommand,
  ): Promise<Result<StreamSession, StreamSessionNotFoundError | InvalidStreamStatusError>> {
    return this.streaming.killSession(cmd);
  }

  async listAuditLog(cmd: ListAuditLogCommand): Promise<CursorPage<AuditLog>> {
    return this.listAuditLogQuery.execute(cmd);
  }

  async getOrdersSummary(cmd: GetOrdersSummaryCommand): Promise<readonly OrdersSummaryPoint[]> {
    return this.getOrdersSummaryQuery.execute(cmd);
  }

  async getOrdersByStatus(): Promise<readonly StatusCount[]> {
    return this.getOrdersByStatusQuery.execute();
  }

  async getSellersSummary(cmd: GetSellersSummaryCommand): Promise<SellersSummary> {
    return this.getSellersSummaryQuery.execute(cmd);
  }

  async getPayoutsSummary(): Promise<readonly PayoutStatusSummary[]> {
    return this.getPayoutsSummaryQuery.execute();
  }

  // User management (Phase C) — reads/writes live in AdminUserPrismaRepository per AGENTS.md §4
  // (only infra/repositories touches Prisma types); this facade normalizes pagination and wires
  // the audit-log trail from the controller side.
  async listUsers(cmd: ListUsersCommand): Promise<CursorPage<AdminUserSummary>> {
    const filter: ListAdminUsersFilter = {
      q: cmd.q,
      status: cmd.status,
      platform: cmd.platform,
      role: cmd.role,
      cursor: cmd.cursor,
      limit: normalizeLimit(cmd.limit),
    };
    return this.adminUsers.list(filter);
  }

  async getUserDetail(userId: string): Promise<AdminUserDetail | null> {
    return this.adminUsers.getDetail(userId);
  }

  async suspendUser(userId: string): Promise<{ id: string; status: string }> {
    return this.adminUsers.updateStatus(userId, 'SUSPENDED');
  }

  async reinstateUser(userId: string): Promise<{ id: string; status: string }> {
    return this.adminUsers.updateStatus(userId, 'ACTIVE');
  }
}
