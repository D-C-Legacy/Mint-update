import { Inject, Injectable } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order } from '../../domain/entities/order.entity';
import { CatalogService } from '../../../catalog/application/catalog.service';
import { SellersService } from '../../../sellers/application/sellers.service';
import type { TransactionClient } from '../../../../platform/database/transaction.manager';

export interface CreateOrderFromSaleCommand {
  // Set by the caller that resolved the sale. The stock change and the order then commit or roll
  // back with that resolution. Undefined only for the event-handler replay, which runs after commit.
  readonly trx: TransactionClient | undefined;
  readonly saleId: string;
  readonly sellerId: string; // Seller.id, matching Sale.sellerId's established convention
  readonly productId: string; // used only to convert the reservation, not persisted on Order
  readonly quantity: number;
  readonly currency: string;
  readonly buyerUserId: string;
  readonly finalAmount: bigint;
}

export type CreateOrderFromSaleOutcome =
  | { readonly kind: 'created'; readonly order: Order }
  | { readonly kind: 'already-exists'; readonly order: Order };

// No Result<T, E> here on purpose — this runs off an internal domain event, not a user request,
// and has no documented "expected" failure a caller could act on (AGENTS.md: Result is for
// expected failures, throw for genuinely unexpected ones). "Already exists" is a valid, handled
// outcome (idempotent replay), not an error.
@Injectable()
export class CreateOrderFromSaleUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    private readonly catalog: CatalogService,
    private readonly sellers: SellersService,
  ) {}

  async execute(cmd: CreateOrderFromSaleCommand): Promise<CreateOrderFromSaleOutcome> {
    const existing = await this.orders.findBySaleId(cmd.saleId, cmd.trx);
    if (existing) {
      return { kind: 'already-exists', order: existing };
    }

    const seller = await this.sellers.getSellerById({ sellerId: cmd.sellerId });
    if (!seller) {
      // Sale.sellerId is a real, already-shipped field pointing at a Seller row created at
      // seller-approval time and never deleted — a miss here is a data-integrity bug, not a
      // reachable business case.
      throw new Error(`Sale ${cmd.saleId} references seller ${cmd.sellerId}, which does not exist`);
    }

    // 03-DATA-MODEL.md §8 invariant: totalAmount = itemAmount + shippingAmount + taxAmount,
    // sellerNetAmount = itemAmount - commissionAmount. No shipping-cost or tax mechanism exists
    // anywhere in the docs yet (shipping is a known catalog-module gap, flagged since P5;
    // no tax ticket exists in any of the 65) — both are 0 until those land.
    const itemAmount = cmd.finalAmount;
    const shippingAmount = 0n;
    const taxAmount = 0n;
    const totalAmount = itemAmount + shippingAmount + taxAmount;
    const commissionBps = seller.commissionBps;
    const commissionAmount = (itemAmount * BigInt(commissionBps)) / 10_000n;
    const sellerNetAmount = itemAmount - commissionAmount;

    if (totalAmount !== itemAmount + shippingAmount + taxAmount) {
      throw new Error(`Order total invariant violated for sale ${cmd.saleId}`);
    }

    // Convert the reservation to sold BEFORE creating the Order row: if this fails, nothing is
    // persisted yet and the handler throws cleanly. The other order matters more than it looks —
    // P5-09 now reserves stock for every sale mode at creation time, so a RESOLVED sale reaching
    // here should always have enough reserved/quantity; a failure means the two accounts have
    // already drifted apart, a genuine bug to surface loudly, not a known reconciliation gap
    // (unlike close-auction's EXPIRED path, which legitimately has nothing reserved today).
    const sold = await this.catalog.markSold({ productId: cmd.productId, qty: cmd.quantity, trx: cmd.trx });
    if (!sold.ok) {
      throw new Error(
        `Failed to convert reservation to sold for sale ${cmd.saleId}, product ${cmd.productId}: ${sold.error.message}`,
      );
    }

    const order = await this.orders.create({
      id: generateId(),
      saleId: cmd.saleId,
      buyerUserId: cmd.buyerUserId,
      sellerId: cmd.sellerId,
      currency: cmd.currency,
      itemAmount,
      shippingAmount,
      taxAmount,
      totalAmount,
      commissionBps,
      commissionAmount,
      sellerNetAmount,
      // Placeholder until the buyer sets a real address via POST /orders/:id/address (P6-08) —
      // the schema's shippingAddress field is non-nullable (matches 03-DATA-MODEL.md §8 exactly)
      // but no address exists yet at order-creation time; flagged, not invented.
      shippingAddress: {},
      initialEvent: {
        id: generateId(),
        type: 'order.created',
        payload: {
          saleId: cmd.saleId,
          itemAmount: itemAmount.toString(),
          commissionBps,
          commissionAmount: commissionAmount.toString(),
          sellerNetAmount: sellerNetAmount.toString(),
        },
      },
    }, cmd.trx);

    return { kind: 'created', order };
  }
}
