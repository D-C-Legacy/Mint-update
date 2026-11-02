import { Inject, Injectable } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { Clock, CLOCK } from '../../../../shared/time/clock';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { PAYOUT_REPOSITORY, PayoutRepositoryPort } from '../../domain/ports/payout.repository.port';
import { TRANSFER_PROVIDER, TransferProviderPort } from '../../domain/ports/transfer-provider.port';
import { LedgerService } from '../../../ledger/application/ledger.service';
import { PayoutRun } from '../../domain/entities/payout-run.entity';
import { Payout } from '../../domain/entities/payout.entity';
import { payoutSentEvent } from '../../events/published/payout-sent.event';

// Single-currency platform (shared/money/currency.ts: CurrencyCode = 'USD' only) — same
// simplification every prior ledger-posting ticket in this codebase has made.
const PLATFORM_CURRENCY = 'USD';

export interface RunPayoutResult {
  readonly run: PayoutRun;
  readonly payoutsCreated: number;
}

// 07-IMPLEMENTATION-PLAN.md's P7-07 deliverable + 00-PRD.md §4.5's 4-step flow. No doc anywhere
// gives a real payout schedule/cadence (same unresolved-number class as the bid increment before
// founder confirmation, or the auto-confirm N-day threshold) and `POST /admin/payout-runs`
// (05-API-SPEC.md §11, "trigger a run manually") has no owning ticket — this use case is the
// whole engine, callable programmatically; no scheduler and no HTTP trigger are built here,
// flagged rather than guessed.
@Injectable()
export class RunPayoutUseCase {
  constructor(
    @Inject(PAYOUT_REPOSITORY) private readonly payouts: PayoutRepositoryPort,
    @Inject(TRANSFER_PROVIDER) private readonly transfer: TransferProviderPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly ledger: LedgerService,
  ) {}

  async execute(): Promise<RunPayoutResult> {
    const startedAt = this.clock.now();
    const previousRun = await this.payouts.findLatestCompletedRun();
    const periodStart = previousRun?.periodEnd ?? new Date(0);

    const run = await this.payouts.createRun({ id: generateId(), periodStart, periodEnd: startedAt, startedAt });

    let totalAmount = 0n;
    let payoutCount = 0;

    // 00-PRD.md §4.5 step 1: "the system totals each seller's available balance" —
    // SellerBalance.availableAmount is the cheap pre-filter for which sellers to even consider;
    // the actual payout amount is independently summed per-order below, never read off the
    // cached balance directly (see listDeliveredOrderCredits' own doc comment).
    const sellerIds = await this.ledger.listSellersWithAvailableBalance(PLATFORM_CURRENCY);
    for (const sellerId of sellerIds) {
      const created = await this.payoutSeller(run.id, sellerId);
      if (created) {
        totalAmount += created.amount;
        payoutCount += 1;
      }
    }

    const completedRun = await this.payouts.completeRun(run.id, {
      status: 'COMPLETED',
      totalAmount,
      payoutCount,
      completedAt: this.clock.now(),
    });

    return { run: completedRun, payoutsCreated: payoutCount };
  }

  // 00-PRD.md §4.5 step 3: "one transfer per seller per run" — enforced twice over: the schema's
  // own `@@unique([runId, sellerId])` on Payout, and this method is only ever called once per
  // sellerId within a single run's loop.
  private async payoutSeller(runId: string, sellerId: string): Promise<Payout | null> {
    const credits = await this.ledger.listDeliveredOrderCredits(sellerId, PLATFORM_CURRENCY);
    if (credits.length === 0) {
      return null;
    }

    // Cheap pre-check for a normal sequential re-run (07-IMPLEMENTATION-PLAN.md's acceptance:
    // "a payout run executed twice transfers once") — the real guarantee against a genuine
    // concurrent race is PayoutItem.orderId's DB-level @unique, enforced inside createPayout.
    const orderIds = credits.map((credit) => credit.orderId);
    const alreadyPaid = await this.payouts.findAlreadyPaidOrderIds(orderIds);
    const uncovered = credits.filter((credit) => !alreadyPaid.has(credit.orderId));
    if (uncovered.length === 0) {
      return null;
    }

    const amount = uncovered.reduce((sum, credit) => sum + credit.amount, 0n);
    const payout = await this.payouts.createPayout({
      id: generateId(),
      runId,
      sellerId,
      amount,
      currency: PLATFORM_CURRENCY,
      idempotencyKey: `payout:${runId}:${sellerId}`,
      items: uncovered.map((credit) => ({ id: generateId(), orderId: credit.orderId, amount: credit.amount })),
    });
    if (!payout) {
      // Lost a genuine race on PayoutItem.orderId to some other concurrent attempt — whatever
      // this would have covered is already covered by the winner. Skip, don't retry with a
      // reduced order set; the next run picks up anything genuinely still uncovered.
      return null;
    }

    const outcome = await this.transfer.createTransfer({
      sellerId,
      amount,
      currency: PLATFORM_CURRENCY,
      idempotencyKey: payout.idempotencyKey,
    });

    const updated = await this.payouts.updatePayoutOutcome(payout.id, {
      status: outcome.status,
      providerTransferId: outcome.providerTransferId,
      failureReason: outcome.failureReason,
      sentAt: outcome.status === 'SENT' ? this.clock.now() : null,
    });

    if (outcome.status === 'SENT') {
      // 03-DATA-MODEL.md §10's documented "Payout sent" transaction can't balance as written
      // (3 equal-amount entries, 1 debit vs 2 credits — see MEMORY.md for the full analysis).
      // User-confirmed reading: DEBIT SELLER_AVAILABLE / CREDIT PLATFORM_CASH. SELLER_PAID_OUT is
      // deliberately NOT credited here — there's no way to also touch it without either
      // unbalancing this transaction or double-counting the liability change; SellerBalance's
      // paidOutAmount stays 0 until a future ticket resolves this properly.
      await this.ledger.post({
        type: 'payout.sent',
        idempotencyKey: `payout.sent:${payout.id}`,
        referenceType: 'payout',
        referenceId: payout.id,
        currency: PLATFORM_CURRENCY,
        entries: [
          { accountType: 'SELLER_AVAILABLE', ownerId: sellerId, direction: 'DEBIT', amount },
          { accountType: 'PLATFORM_CASH', ownerId: null, direction: 'CREDIT', amount },
        ],
      });

      await this.eventBus.publish(
        payoutSentEvent({ payoutId: updated.id, sellerId, amount: amount.toString(), currency: PLATFORM_CURRENCY }),
      );
    }

    return updated;
  }
}
