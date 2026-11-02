import type { TransactionClient } from '../../../../platform/database/transaction.manager';
import { Order, OrderStatus } from '../entities/order.entity';

export const ORDER_REPOSITORY = Symbol('OrderRepositoryPort');

export interface CreateOrderInput {
  readonly id: string;
  readonly saleId: string;
  readonly buyerUserId: string;
  readonly sellerId: string;
  readonly currency: string;
  readonly itemAmount: bigint;
  readonly shippingAmount: bigint;
  readonly taxAmount: bigint;
  readonly totalAmount: bigint;
  readonly commissionBps: number;
  readonly commissionAmount: bigint;
  readonly sellerNetAmount: bigint;
  readonly shippingAddress: Record<string, unknown>;
  readonly initialEvent: {
    readonly id: string;
    readonly type: string;
    readonly payload: Record<string, unknown>;
  };
}

export interface MarkShippedInput {
  readonly carrier: string;
  readonly trackingNumber: string;
}

export interface ListByStatusFilter {
  // `undefined` means no status filter — "all orders" (05-API-SPEC.md §11's `GET /admin/orders`,
  // "All orders, filterable"), reusing the same method P8-05's DISPUTED-locked dashboard needed.
  readonly status: OrderStatus | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}

// Extended again in P6-08 (markShipped/markDelivered/findShippedBefore) — still deliberately
// minimal: `GET /orders`, `GET /orders/:id`, `GET /seller/orders` read-side queries, and setting
// a shipping address (`POST /orders/:id/address`, documented in 05-API-SPEC.md §8 but unowned by
// ANY of the 65 tickets — not this one either) are still not built here.
export interface OrderRepositoryPort {
  findBySaleId(saleId: string, trx?: TransactionClient): Promise<Order | null>;
  findById(id: string): Promise<Order | null>;
  create(input: CreateOrderInput, trx?: TransactionClient): Promise<Order>;
  /** Atomic `WHERE status='PENDING_PAYMENT'` guard, same shape as sales'
   *  `resolveOpenToResolved` — null means another call already won this transition. Also
   *  appends an `order.paid` OrderEvent row. */
  markPaid(id: string, paymentId: string): Promise<Order | null>;
  /** Atomic `WHERE status IN (PAID, SHIPPED, DELIVERED, COMPLETED)` guard (REFUND's legal
   *  origin set per order-status-transition.rule.ts). Also appends an `order.refunded`
   *  OrderEvent row. Only called for a FULL refund — see RefundPaymentUseCase. */
  markRefunded(id: string, refundId: string): Promise<Order | null>;
  /** Atomic `WHERE status IN (PAID, SHIPPED, DELIVERED)` guard (DISPUTE's origin set). Appends an
   *  `order.disputed` OrderEvent row carrying the processor's dispute id. */
  markDisputed(id: string, disputeId: string): Promise<Order | null>;
  /** Atomic `WHERE status='PAID'` guard. Also sets `shippedAt`/`carrier`/`trackingNumber` and
   *  appends an `order.shipped` OrderEvent row. */
  markShipped(id: string, input: MarkShippedInput): Promise<Order | null>;
  /** Atomic `WHERE status IN (allowedFrom)` guard — the caller (CancelOrderUseCase) passes a
   *  narrower set for a buyer (`['PENDING_PAYMENT']`) than the full documented seller/admin range
   *  (05-API-SPEC.md §8: "Cancel before shipment", PENDING_PAYMENT or PAID). Also sets
   *  `cancelledAt`/`cancelReason` and appends an `order.cancelled` OrderEvent row. */
  markCancelled(id: string, allowedFrom: readonly OrderStatus[], reason: string | null): Promise<Order | null>;
  /** Atomic `WHERE status='SHIPPED'` guard. Also sets `deliveredAt`/`deliveryConfirmedBy` and
   *  appends an `order.delivered` OrderEvent row. `confirmedBy` is only ever BUYER or AUTO here
   *  — CARRIER/ADMIN confirmation paths are out of this ticket's deliverable list, unbuilt. */
  markDelivered(id: string, confirmedBy: 'BUYER' | 'AUTO' | 'ADMIN'): Promise<Order | null>;
  /** SHIPPED orders whose `shippedAt` is at or before `cutoff` — the auto-confirm sweep's own
   *  query, same shape as sales' `findExpiredOpen`. */
  findShippedBefore(cutoff: Date, limit: number): Promise<Order[]>;
  /** Added for P8-05's "disputed orders" admin queue (status locked to DISPUTED there); widened
   *  in P8-06 to accept `status: undefined` for `GET /admin/orders`'s "all orders, filterable"
   *  (gap flagged since P6-06/07/08, closed here). Ordered by `createdAt` desc, cursor is the
   *  last row's `id`, same pagination idiom as `listFollowing`/`listApplications`. */
  findByStatus(filter: ListByStatusFilter): Promise<Order[]>;
  /** The buyer's own orders, newest first (GET /v1/orders). Cursor is the last row's id. */
  findByBuyer(filter: ListByBuyerFilter): Promise<Order[]>;
  /** The seller's order queue, newest first (GET /v1/seller/orders). Optional status filter. */
  findBySeller(filter: ListBySellerFilter): Promise<Order[]>;
  /** Atomic `WHERE status IN (PENDING_PAYMENT, PAID)` guard — the address may be set or changed
   *  until the order ships (05-API-SPEC.md §8). Null means the order is already past that point. */
  setShippingAddress(id: string, address: Record<string, unknown>): Promise<Order | null>;
}

export interface ListByBuyerFilter {
  readonly buyerUserId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface ListBySellerFilter {
  readonly sellerId: string;
  readonly status: OrderStatus | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}
