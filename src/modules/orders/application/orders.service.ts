import { Injectable } from '@nestjs/common';
import { Result } from '../../../shared/result/result';
import {
  CreateOrderFromSaleUseCase,
  CreateOrderFromSaleCommand,
  CreateOrderFromSaleOutcome,
} from './commands/create-order-from-sale.usecase';
import { MarkOrderPaidUseCase, MarkOrderPaidCommand } from './commands/mark-order-paid.usecase';
import {
  MarkOrderRefundedUseCase,
  MarkOrderRefundedCommand,
} from './commands/mark-order-refunded.usecase';
import {
  MarkOrderDisputedUseCase,
  MarkOrderDisputedCommand,
} from './commands/mark-order-disputed.usecase';
import { ShipOrderUseCase, ShipOrderCommand } from './commands/ship-order.usecase';
import {
  ConfirmDeliveryUseCase,
  ConfirmDeliveryCommand,
} from './commands/confirm-delivery.usecase';
import { CancelOrderUseCase, CancelOrderCommand } from './commands/cancel-order.usecase';
import {
  CancelOrderAsSellerOrAdminUseCase,
  CancelOrderAsSellerOrAdminCommand,
} from './commands/cancel-order-as-seller-or-admin.usecase';
import { GetOrderQuery, GetOrderCommand } from './queries/get-order.query';
import {
  ListDisputedOrdersQuery,
  ListDisputedOrdersCommand,
} from './queries/list-disputed-orders.query';
import { ListOrdersQuery, ListOrdersCommand } from './queries/list-orders.query';
import { ListMyOrdersQuery, ListMyOrdersCommand } from './queries/list-my-orders.query';
import { GetMyOrderQuery, GetMyOrderCommand } from './queries/get-my-order.query';
import { ListSellerOrdersQuery, ListSellerOrdersCommand } from './queries/list-seller-orders.query';
import {
  GetSellerOrdersSummaryQuery,
  GetSellerOrdersSummaryCommand,
} from './queries/get-seller-orders-summary.query';
import {
  GetSellerOrdersByStatusQuery,
  GetSellerOrdersByStatusCommand,
} from './queries/get-seller-orders-by-status.query';
import {
  SellerOrdersSummaryPoint,
  SellerStatusCount,
} from '../domain/entities/seller-analytics.entity';
import {
  SetShippingAddressUseCase,
  SetShippingAddressCommand,
} from './commands/set-shipping-address.usecase';
import { Order } from '../domain/entities/order.entity';
import { OrderNotFoundError, InvalidOrderStatusError } from '../domain/errors/orders.errors';
import { CursorPage } from '../../../shared/pagination/cursor';

@Injectable()
export class OrdersService {
  constructor(
    private readonly createOrderFromSaleUseCase: CreateOrderFromSaleUseCase,
    private readonly markOrderPaidUseCase: MarkOrderPaidUseCase,
    private readonly markOrderRefundedUseCase: MarkOrderRefundedUseCase,
    private readonly markOrderDisputedUseCase: MarkOrderDisputedUseCase,
    private readonly shipOrderUseCase: ShipOrderUseCase,
    private readonly confirmDeliveryUseCase: ConfirmDeliveryUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    private readonly cancelOrderAsSellerOrAdminUseCase: CancelOrderAsSellerOrAdminUseCase,
    private readonly getOrderQuery: GetOrderQuery,
    private readonly listDisputedOrdersQuery: ListDisputedOrdersQuery,
    private readonly listOrdersQuery: ListOrdersQuery,
    private readonly listMyOrdersQuery: ListMyOrdersQuery,
    private readonly getMyOrderQuery: GetMyOrderQuery,
    private readonly listSellerOrdersQuery: ListSellerOrdersQuery,
    private readonly getSellerOrdersSummaryQuery: GetSellerOrdersSummaryQuery,
    private readonly getSellerOrdersByStatusQuery: GetSellerOrdersByStatusQuery,
    private readonly setShippingAddressUseCase: SetShippingAddressUseCase,
  ) {}

  async listMyOrders(cmd: ListMyOrdersCommand): Promise<CursorPage<Order>> {
    return this.listMyOrdersQuery.execute(cmd);
  }

  async getMyOrder(cmd: GetMyOrderCommand): Promise<Result<Order, OrderNotFoundError>> {
    return this.getMyOrderQuery.execute(cmd);
  }

  async listSellerOrders(cmd: ListSellerOrdersCommand): Promise<CursorPage<Order>> {
    return this.listSellerOrdersQuery.execute(cmd);
  }

  async setShippingAddress(
    cmd: SetShippingAddressCommand,
  ): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    return this.setShippingAddressUseCase.execute(cmd);
  }

  async createFromSale(cmd: CreateOrderFromSaleCommand): Promise<CreateOrderFromSaleOutcome> {
    return this.createOrderFromSaleUseCase.execute(cmd);
  }

  async getOrder(cmd: GetOrderCommand): Promise<Order | null> {
    return this.getOrderQuery.execute(cmd);
  }

  async markPaid(
    cmd: MarkOrderPaidCommand,
  ): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    return this.markOrderPaidUseCase.execute(cmd);
  }

  async markRefunded(
    cmd: MarkOrderRefundedCommand,
  ): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    return this.markOrderRefundedUseCase.execute(cmd);
  }

  async markDisputed(
    cmd: MarkOrderDisputedCommand,
  ): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    return this.markOrderDisputedUseCase.execute(cmd);
  }

  async ship(
    cmd: ShipOrderCommand,
  ): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    return this.shipOrderUseCase.execute(cmd);
  }

  async confirmDelivery(
    cmd: ConfirmDeliveryCommand,
  ): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    return this.confirmDeliveryUseCase.execute(cmd);
  }

  async cancel(
    cmd: CancelOrderCommand,
  ): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    return this.cancelOrderUseCase.execute(cmd);
  }

  async cancelAsSellerOrAdmin(
    cmd: CancelOrderAsSellerOrAdminCommand,
  ): Promise<Result<Order, OrderNotFoundError | InvalidOrderStatusError>> {
    return this.cancelOrderAsSellerOrAdminUseCase.execute(cmd);
  }

  async listDisputedOrders(cmd: ListDisputedOrdersCommand): Promise<CursorPage<Order>> {
    return this.listDisputedOrdersQuery.execute(cmd);
  }

  async listOrders(cmd: ListOrdersCommand): Promise<CursorPage<Order>> {
    return this.listOrdersQuery.execute(cmd);
  }

  async getSellerOrdersSummary(
    cmd: GetSellerOrdersSummaryCommand,
  ): Promise<readonly SellerOrdersSummaryPoint[]> {
    return this.getSellerOrdersSummaryQuery.execute(cmd);
  }

  async getSellerOrdersByStatus(
    cmd: GetSellerOrdersByStatusCommand,
  ): Promise<readonly SellerStatusCount[]> {
    return this.getSellerOrdersByStatusQuery.execute(cmd);
  }
}
