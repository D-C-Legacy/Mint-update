import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { Clock, CLOCK } from '../../../../shared/time/clock';
import { TransactionManager } from '../../../../platform/database/transaction.manager';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { salesConfig } from '../../../../config/sales.config';
import { SALE_REPOSITORY, SaleRepositoryPort } from '../../domain/ports/sale.repository.port';
import { Sale } from '../../domain/entities/sale.entity';
import { SaleNotFoundError, SaleNotOpenError } from '../../domain/errors/sales.errors';
import { saleModeSwitchedEvent } from '../../events/published/sale-mode-switched.event';
import { SellersService } from '../../../sellers/application/sellers.service';

export type SwitchSaleModeCommand =
  | {
      readonly saleId: string;
      readonly sellerUserId: string;
      readonly mode: 'BUY_NOW';
      readonly price: bigint;
      readonly quantity: number;
    }
  | {
      readonly saleId: string;
      readonly sellerUserId: string;
      readonly mode: 'AUCTION';
      readonly startAmount: bigint;
      readonly durationSeconds?: number;
    }
  | {
      readonly saleId: string;
      readonly sellerUserId: string;
      readonly mode: 'OFFER';
    };

export interface SwitchSaleModeResult {
  readonly sale: Sale;
}

// founder_requests.md §1, resolved 14 Oct 2026: switching mode keeps the same Sale row and its
// existing bids — auction-only fields (currentAmount/currentBidId/extensionCount) are left as-is
// regardless of which way the switch goes, so a later switch back to AUCTION resumes from
// wherever bidding actually was, not from startAmount again.
@Injectable()
export class SwitchSaleModeUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly sales: SaleRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly sellers: SellersService,
    private readonly tx: TransactionManager,
  ) {}

  async execute(
    cmd: SwitchSaleModeCommand,
  ): Promise<Result<SwitchSaleModeResult, SaleNotFoundError | SaleNotOpenError>> {
    const sale = await this.sales.findById(cmd.saleId);
    if (!sale) {
      return Err(new SaleNotFoundError(cmd.saleId));
    }

    // 404, not 403 — same hide-existence treatment as cancel-sale's ownership check.
    const callerSeller = await this.sellers.getMySeller({ userId: cmd.sellerUserId });
    if (!callerSeller.ok || callerSeller.value.seller.id !== sale.sellerId) {
      return Err(new SaleNotFoundError(cmd.saleId));
    }

    const now = this.clock.now();

    // Locked, same as place-bid — a switch racing a concurrent bid is exactly the interleaving
    // 06-REALTIME-AND-CONCURRENCY.md §4 exists to prevent, even though this use case isn't a bid
    // itself.
    const outcome = await this.tx.run<Result<Sale, SaleNotFoundError | SaleNotOpenError>>(
      async (trx) => {
        const locked = await this.sales.lockForUpdate(trx, cmd.saleId);
        if (!locked) {
          return Err(new SaleNotFoundError(cmd.saleId));
        }
        if (locked.status !== 'OPEN') {
          return Err(new SaleNotOpenError(locked.id, locked.status));
        }

        const updated = await this.sales.switchMode(
          trx,
          locked.id,
          cmd.mode === 'BUY_NOW'
            ? { mode: 'BUY_NOW', price: cmd.price, quantity: cmd.quantity }
            : cmd.mode === 'AUCTION'
              ? {
                  mode: 'AUCTION',
                  startAmount: cmd.startAmount,
                  endsAt: new Date(
                    now.getTime() +
                      (cmd.durationSeconds ?? salesConfig.defaultAuctionDurationSeconds) * 1000,
                  ),
                }
              : { mode: 'OFFER' },
        );
        return Ok(updated);
      },
    );

    if (!outcome.ok) {
      return outcome;
    }

    const updated = outcome.value;

    // AFTER commit, never before (AGENTS.md §4) — a rolled-back transaction that already
    // broadcast would show viewers a mode that never actually took effect.
    await this.eventBus.publish(
      saleModeSwitchedEvent({
        saleId: updated.id,
        sessionId: updated.sessionId,
        mode: updated.mode,
        currentAmount: updated.currentAmount?.toString() ?? null,
        price: updated.price?.toString() ?? null,
        endsAt: updated.endsAt?.toISOString() ?? null,
      }),
    );

    return Ok({ sale: updated });
  }
}
