import { Inject, Injectable } from '@nestjs/common';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order } from '../../domain/entities/order.entity';

export interface GetOrderCommand {
  readonly orderId: string;
}

// Plain nullable return, no Result wrapping — same shape as sellers' GetSellerByIdQuery (P5-09):
// a simple lookup with no domain decision of its own. Ownership checks (is this caller the
// buyer/seller on the order) are the calling module's job, same as every other cross-module
// facade in this codebase (SellersService.getSellerById doesn't scope by caller either).
@Injectable()
export class GetOrderQuery {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort) {}

  async execute(cmd: GetOrderCommand): Promise<Order | null> {
    return this.orders.findById(cmd.orderId);
  }
}
