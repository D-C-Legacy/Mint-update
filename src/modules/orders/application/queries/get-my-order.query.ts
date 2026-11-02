import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order } from '../../domain/entities/order.entity';
import { OrderNotFoundError } from '../../domain/errors/orders.errors';
import { SellersService } from '../../../sellers/application/sellers.service';

export interface GetMyOrderCommand {
  readonly userId: string;
  readonly orderId: string;
}

// One order, for its buyer or its seller (GET /v1/orders/:id). Anyone else gets the same 404 as a
// missing order, so the existence of other people's orders is not revealed.
@Injectable()
export class GetMyOrderQuery {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    private readonly sellers: SellersService,
  ) {}

  async execute(cmd: GetMyOrderCommand): Promise<Result<Order, OrderNotFoundError>> {
    const order = await this.orders.findById(cmd.orderId);
    if (!order) return Err(new OrderNotFoundError(cmd.orderId));
    if (order.buyerUserId === cmd.userId) return Ok(order);

    const seller = await this.sellers.getMySeller({ userId: cmd.userId });
    if (seller.ok && seller.value.seller.id === order.sellerId) return Ok(order);

    return Err(new OrderNotFoundError(cmd.orderId));
  }
}
