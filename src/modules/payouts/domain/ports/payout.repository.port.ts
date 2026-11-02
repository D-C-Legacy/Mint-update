import { PayoutRun, PayoutRunStatus } from '../entities/payout-run.entity';
import { Payout, PayoutStatus } from '../entities/payout.entity';

export const PAYOUT_REPOSITORY = Symbol('PayoutRepositoryPort');

export interface CreatePayoutRunInput {
  readonly id: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly startedAt: Date;
}

export interface CompleteRunInput {
  readonly status: PayoutRunStatus;
  readonly totalAmount: bigint;
  readonly payoutCount: number;
  readonly completedAt: Date;
}

export interface CreatePayoutItemInput {
  readonly id: string;
  readonly orderId: string;
  readonly amount: bigint;
}

export interface CreatePayoutInput {
  readonly id: string;
  readonly runId: string;
  readonly sellerId: string;
  readonly amount: bigint;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly items: readonly CreatePayoutItemInput[];
}

export interface UpdatePayoutOutcomeInput {
  readonly status: PayoutStatus;
  readonly providerTransferId: string | null;
  readonly failureReason: string | null;
  readonly sentAt: Date | null;
}

export interface ListByStatusFilter {
  readonly status: PayoutStatus;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface ListBySellerFilter {
  readonly sellerId: string;
  readonly status: PayoutStatus | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface ListRunsFilter {
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface PayoutRepositoryPort {
  findLatestCompletedRun(): Promise<PayoutRun | null>;
  createRun(input: CreatePayoutRunInput): Promise<PayoutRun>;
  completeRun(id: string, input: CompleteRunInput): Promise<PayoutRun>;
  findPayoutById(id: string): Promise<Payout | null>;
  /** Cheap pre-check, not the real correctness guarantee — a normal sequential re-run of
   *  `RunPayoutUseCase` uses this to skip orders a prior run already covered, without even
   *  attempting a write. The real guarantee against a genuine concurrent race is
   *  `PayoutItem.orderId`'s DB-level `@unique`, enforced inside `createPayout` below. */
  findAlreadyPaidOrderIds(orderIds: readonly string[]): Promise<ReadonlySet<string>>;
  /** One Prisma nested-write call (`items: { create: [...] }`), atomic in a single round trip —
   *  same "prefer nested writes" precedent as P7-03's `LedgerRepositoryPort.createTransaction`.
   *  Returns `null`, not the colliding row, when any `PayoutItem.orderId` collides: unlike
   *  P3-04/P6-07's "fetch-and-return-existing" shape, there is no single winning `Payout` to
   *  hand back here — a genuine race means some OTHER payout (possibly covering a different
   *  order set) already claimed one of these orders, so this seller is simply skipped for this
   *  run; whatever it would have covered gets picked up by the next run instead. */
  createPayout(input: CreatePayoutInput): Promise<Payout | null>;
  updatePayoutOutcome(id: string, input: UpdatePayoutOutcomeInput): Promise<Payout>;
  /** Added for P8-05's "failed payouts" / "held payouts" admin queues — reused for both via the
   *  `status` param rather than two near-identical methods. `HELD` (schema.prisma's
   *  `PayoutStatus`) is new in this same ticket — `03-DATA-MODEL.md`'s AuditLog example already
   *  names `payout.held` as an action and `05-API-SPEC.md` §11 documents
   *  `POST /admin/payouts/:id/hold`, so the status this queue reads was a zero-ambiguity gap to
   *  close now; the actual hold/un-hold transition use case remains P8-06's job, unbuilt here. */
  findByStatus(filter: ListByStatusFilter): Promise<Payout[]>;
  /** `GET /seller/payouts` (05-API-SPEC.md §10: "Payout history") — a seller's own payouts,
   *  newest first, optionally filtered by status. Unlike `findByStatus` (admin-wide, status
   *  required), status is optional here: a seller's own history has a natural "all" view. */
  findBySeller(filter: ListBySellerFilter): Promise<Payout[]>;
  /** `GET /admin/payout-runs` (05-API-SPEC.md §11, "List runs") — unowned by any ticket.
   *  Ordered by `createdAt` desc, same cursor idiom as `findByStatus`. */
  listRuns(filter: ListRunsFilter): Promise<PayoutRun[]>;
  /** `POST /admin/payouts/:id/hold` (05-API-SPEC.md §11) — atomic `WHERE status='PENDING'`
   *  guard, same shape as orders' `markPaid`/`markShipped`; `null` means the payout wasn't
   *  PENDING (already processing/sent/failed/reversed/held). */
  holdPayout(id: string): Promise<Payout | null>;
}
