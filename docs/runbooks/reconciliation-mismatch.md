# Reconciliation mismatch

The ledger reconciliation found an inconsistency. You will see one or both of:

- A CRITICAL log line and an email (if `ALERT_EMAIL_TO` is set) with the subject
  `Ledger reconciliation mismatch`. The condition key is `ledger-reconciliation-mismatch`.
- A failed `ledger.reconcile` job in the worker, with an error starting
  `Ledger reconciliation found a mismatch`.

The alert fires as soon as the check finds the mismatch. It does not wait for a sweep to
notice a pattern. The job repeats every 24 hours, so a mismatch that is not fixed will alert
again after each cooldown (`ALERT_COOLDOWN_MINUTES`, default 15) and again on the next run.

## What the check covers

The reconciliation compares three things:

1. **Every transaction balances.** Debits equal credits. Reported as `unbalancedTransactionIds`.
2. **Seller balance projections match their entries.** The cached `SellerBalance` (pending,
   available, paid out) is compared with a value recomputed from ledger entries. Reported as
   `balanceMismatches`, one per field, with the `cached` and `recomputed` amounts.
3. **Ledger cash matches processor totals.** **Not implemented.** See Known gaps.

## Confirm

1. Get the full report: `GET /v1/admin/ledger/reconciliation` with an admin JWT. Read `ok`,
   `unbalancedTransactionIds`, and `balanceMismatches`.
2. Work out the scope. An unbalanced transaction points at one bad write. Balance mismatches
   on one seller point at that seller's projection. Mismatches across many sellers at once
   point at a bug in the posting code or a bad deploy. Check whether a deploy happened near
   the first failing run.
3. Note the first run that failed. The previous run was clean, so the problem lies between the
   two.

## Act

1. **Freeze the affected money first.** Hold payouts for every seller in
   `balanceMismatches`: `POST /v1/admin/payouts/:id/hold`, one payout at a time, with
   `Idempotency-Key`. Confirm the hold is respected (see the caveat in `failed-payout.md`).
   Do this before any repair, so no money leaves while the books are wrong.
2. **Do not edit ledger rows, balances or bids.** The ledger is append-only. No `UPDATE` or
   `DELETE`. A projection mismatch is not fixed by writing the projection. Rebuild it from
   entries through an engineering change, or fix the posting bug and rebuild.
3. **Stop the bleeding.** If a recent deploy caused the mismatch, roll it back (see
   `rollback.md`). Rolling back does not repair the rows it already wrote.
4. **Escalate to the founder and engineering the same day.** The repair is an engineering
   change that adds compensating entries, followed by a rebuild of the affected projections.
   The founder decides how to make affected sellers and buyers whole.

## Known gaps

- **Check 3, ledger cash against processor totals, is not implemented.** The report says so
  explicitly and marks it not implemented rather than passing it. A mismatch between the
  ledger and Stripe's own totals will not be detected by this job.
- **No compensating-entry or adjustment route exists.** There is no admin operation that posts
  a correction. Every repair today is an engineering change.
- **Projection rebuild has no operational entry point.** Rebuilding `SellerBalance` from
  entries is not exposed as a route or job that on-call can run.
- **The payment side is incomplete.** Stripe webhook events are recorded but their effects are
  not yet applied to orders or the ledger (see `provider-outage.md`). A reconciliation that
  looks clean may still be missing payment effects that never reached the ledger.

## Escalate

Escalate on the first failing run. Do not wait for the next alert.
