import { Injectable } from '@nestjs/common';
import { Prisma, OrderStatus as PrismaOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type { TransactionClient } from '../../../../platform/database/transaction.manager';
import { generateId } from '../../../../shared/ids/id';
import {
  CreateOrderInput,
  ListByBuyerFilter,
  ListBySellerFilter,
  ListByStatusFilter,
  MarkShippedInput,
  OrderRepositoryPort,
} from '../../domain/ports/order.repository.port';
import { Order, OrderStatus } from '../../domain/entities/order.entity';
import { toDomainOrder } from '../mappers/order.mapper';

const REFUNDABLE_STATUSES: PrismaOrderStatus[] = ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'];
const DISPUTABLE_STATUSES: PrismaOrderStatus[] = ['PAID', 'SHIPPED', 'DELIVERED'];
const ADDRESSABLE_STATUSES: PrismaOrderStatus[] = ['PENDING_PAYMENT', 'PAID'];

@Injectable()
export class OrderPrismaRepository implements OrderRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findBySaleId(saleId: string, trx?: TransactionClient): Promise<Order | null> {
    const row = await (trx ?? this.prisma).order.findUnique({ where: { saleId } });
    return row ? toDomainOrder(row) : null;
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({ where: { id } });
    return row ? toDomainOrder(row) : null;
  }

  // Two plain sequential writes, not a TransactionManager transaction — unlike P5-06's bid+sale
  // update, a crash between these two is a negligible audit-log gap (the OrderEvent row), not a
  // money-correctness bug: the guarded `updateMany` is what actually prevents a double PAY/REFUND
  // transition, and it already committed by the time the event write could fail.
  async markPaid(id: string, paymentId: string): Promise<Order | null> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, status: 'PENDING_PAYMENT' },
      data: { status: 'PAID' },
    });
    if (count === 0) {
      return null;
    }
    await this.prisma.orderEvent.create({
      data: { id: generateId(), orderId: id, type: 'order.paid', payload: { paymentId } },
    });
    return this.findById(id);
  }

  async markRefunded(id: string, refundId: string): Promise<Order | null> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, status: { in: REFUNDABLE_STATUSES } },
      data: { status: 'REFUNDED' },
    });
    if (count === 0) {
      return null;
    }
    await this.prisma.orderEvent.create({
      data: { id: generateId(), orderId: id, type: 'order.refunded', payload: { refundId } },
    });
    return this.findById(id);
  }

  async markDisputed(id: string, disputeId: string): Promise<Order | null> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, status: { in: DISPUTABLE_STATUSES } },
      data: { status: 'DISPUTED' },
    });
    if (count === 0) {
      return null;
    }
    await this.prisma.orderEvent.create({
      data: { id: generateId(), orderId: id, type: 'order.disputed', payload: { disputeId } },
    });
    return this.findById(id);
  }

  async markShipped(id: string, input: MarkShippedInput): Promise<Order | null> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, status: 'PAID' },
      data: { status: 'SHIPPED', carrier: input.carrier, trackingNumber: input.trackingNumber, shippedAt: new Date() },
    });
    if (count === 0) {
      return null;
    }
    await this.prisma.orderEvent.create({
      data: {
        id: generateId(),
        orderId: id,
        type: 'order.shipped',
        payload: { carrier: input.carrier, trackingNumber: input.trackingNumber },
      },
    });
    return this.findById(id);
  }

  async markDelivered(id: string, confirmedBy: 'BUYER' | 'AUTO' | 'ADMIN'): Promise<Order | null> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, status: 'SHIPPED' },
      data: { status: 'DELIVERED', deliveredAt: new Date(), deliveryConfirmedBy: confirmedBy },
    });
    if (count === 0) {
      return null;
    }
    await this.prisma.orderEvent.create({
      data: { id: generateId(), orderId: id, type: 'order.delivered', payload: { confirmedBy } },
    });
    return this.findById(id);
  }

  async markCancelled(id: string, allowedFrom: readonly OrderStatus[], reason: string | null): Promise<Order | null> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, status: { in: allowedFrom as PrismaOrderStatus[] } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
    });
    if (count === 0) {
      return null;
    }
    await this.prisma.orderEvent.create({
      data: { id: generateId(), orderId: id, type: 'order.cancelled', payload: { reason } },
    });
    return this.findById(id);
  }

  async findShippedBefore(cutoff: Date, limit: number): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({
      where: { status: 'SHIPPED', shippedAt: { lte: cutoff } },
      take: limit,
    });
    return rows.map(toDomainOrder);
  }

  async findByStatus(filter: ListByStatusFilter): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({
      where: { ...(filter.status !== undefined ? { status: filter.status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainOrder);
  }

  async findByBuyer(filter: ListByBuyerFilter): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({
      where: { buyerUserId: filter.buyerUserId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainOrder);
  }

  async findBySeller(filter: ListBySellerFilter): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({
      where: {
        sellerId: filter.sellerId,
        ...(filter.status !== undefined ? { status: filter.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainOrder);
  }

  async setShippingAddress(id: string, address: Record<string, unknown>): Promise<Order | null> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, status: { in: ADDRESSABLE_STATUSES } },
      data: { shippingAddress: address as Prisma.InputJsonValue },
    });
    if (count === 0) {
      return null;
    }
    return this.findById(id);
  }

  // Nested write (Order + its first OrderEvent) in one Prisma call, atomic in one round trip —
  // same precedent as sellers' Seller+SellerApplication aggregate (P2-03): no TransactionManager
  // needed when the whole op is expressible as a single Prisma nested `create`.
  async create(input: CreateOrderInput, trx?: TransactionClient): Promise<Order> {
    const row = await (trx ?? this.prisma).order.create({
      data: {
        id: input.id,
        saleId: input.saleId,
        buyerUserId: input.buyerUserId,
        sellerId: input.sellerId,
        currency: input.currency,
        itemAmount: input.itemAmount,
        shippingAmount: input.shippingAmount,
        taxAmount: input.taxAmount,
        totalAmount: input.totalAmount,
        commissionBps: input.commissionBps,
        commissionAmount: input.commissionAmount,
        sellerNetAmount: input.sellerNetAmount,
        shippingAddress: input.shippingAddress as Prisma.InputJsonValue,
        events: {
          create: [
            {
              id: input.initialEvent.id,
              type: input.initialEvent.type,
              payload: input.initialEvent.payload as Prisma.InputJsonValue,
            },
          ],
        },
      },
    });
    return toDomainOrder(row);
  }
}
