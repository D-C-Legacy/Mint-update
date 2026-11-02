import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { Clock, CLOCK } from '../../../../shared/time/clock';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { SALE_REPOSITORY, SaleRepositoryPort } from '../../domain/ports/sale.repository.port';
import { SaleNotFoundError, SaleNotOpenError } from '../../domain/errors/sales.errors';
import { saleCancelledEvent } from '../../events/published/sale-cancelled.event';
import { SellersService } from '../../../sellers/application/sellers.service';
import { CatalogService } from '../../../catalog/application/catalog.service';

export interface CancelSaleCommand {
  readonly saleId: string;
  readonly sellerUserId: string;
}

export interface CancelSaleResult {
  readonly saleId: string;
}

@Injectable()
export class CancelSaleUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly sales: SaleRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly sellers: SellersService,
    private readonly catalog: CatalogService,
  ) {}

  async execute(cmd: CancelSaleCommand): Promise<Result<CancelSaleResult, SaleNotFoundError | SaleNotOpenError>> {
    const sale = await this.sales.findById(cmd.saleId);
    if (!sale) {
      return Err(new SaleNotFoundError(cmd.saleId));
    }

    // 404, not 403 — same hide-existence treatment as every other ownership check in this
    // codebase (catalog's established precedent, P3-02).
    const callerSeller = await this.sellers.getMySeller({ userId: cmd.sellerUserId });
    if (!callerSeller.ok || callerSeller.value.seller.id !== sale.sellerId) {
      return Err(new SaleNotFoundError(cmd.saleId));
    }

    const now = this.clock.now();
    const cancelled = await this.sales.cancelOpen(sale.id, now);
    if (!cancelled) {
      return Err(new SaleNotOpenError(sale.id, sale.status));
    }

    // Best-effort, same treatment as close-auction's EXPIRED path (P5-07) — not checked,
    // because the sale's own cancellation must never be blocked by an inventory
    // reconciliation issue.
    await this.catalog.releaseStock({ productId: sale.productId, qty: sale.quantity });

    await this.eventBus.publish(
      saleCancelledEvent({
        saleId: sale.id,
        sessionId: sale.sessionId,
        reason: 'SELLER_CANCELLED',
        resolvedAt: now.toISOString(),
      }),
    );

    return Ok({ saleId: sale.id });
  }
}
