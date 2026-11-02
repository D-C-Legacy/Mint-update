# Failed payout

A payout run or an individual payout is marked `FAILED`, or a seller reports that an expected
payout has not arrived.

## Read this first: no real money moves yet

The transfer adapter is `MockTransferAdapter` (`modules/payouts/infra/transfer/`). It always
returns `SENT` with a fake transfer id. Nothing contacts a bank. Two decisions that would name a
real payout rail are still open: `D-001` and `D-002` in `09-DECISIONS.md`.

Consequences for on-call:

- A `FAILED` payout today cannot come from the transfer provider. It means a code or data
  problem inside the run, or someone has swapped in a real adapter without this runbook being
  updated. Find out which before doing anything else.
- No seller has been paid out through this system. A seller who says "I was not paid" is
  describing ledger state, not a bank transfer.

If you find a real transfer adapter wired in, stop and escalate. The payout runbook below
assumes the mock.

## Confirm

1. List recent runs: `GET /v1/admin/payout-runs`. Note the run id and status (`PENDING`,
   `RUNNING`, `COMPLETED` or `FAILED`).
2. Read the failure. Payout runs execute inside the admin request that starts them, not in a
   worker job, so the run's own response and the api process logs carry the error. Per-payout
   failure reasons are stored on the payout row (`PayoutStatus.FAILED`).
3. For a seller's complaint, check their balance and entries before touching payouts. The
   balance is a projection rebuilt from ledger entries. The entries are the record.

## Act

1. **Stop further money leaving for the affected seller.** Hold their payout:
   `POST /v1/admin/payouts/:id/hold`, with an `Idempotency-Key`. Marking a payout `HELD` is
   recorded, but **confirm with engineering that new payout runs skip `HELD` payouts before
   relying on this.** I could not verify that from the code. This build has no unhold route, so
   a hold can only be lifted by an engineering change. Use it deliberately.
2. **Do not re-run the same run to "try again."** Payout keys are scoped per run and seller
   (`payout:<runId>:<sellerId>`). Re-running a run with the same key replays what already
   happened. Starting a new run through `POST /v1/admin/payout-runs` covers only credits not yet
   covered by a payout. Before starting a new run, confirm with engineering that the failed
   payout's credits are not already marked covered. Otherwise a new run could pay a seller
   twice, or skip them.
3. **Escalate the money decision to the founder.** Whether to re-pay, reverse, or wait is a
   business decision. Give them the run id, the seller id, the amount and the failure reason.

## Known gaps

- **No unhold, retry, or reverse route.** Recovering a failed or held payout needs an
  engineering change today.
- **The transfer provider is a mock.** A genuine transfer failure path has never executed
  against a real rail.
- **The `payouts/:id/hold` route is the only payout action on the admin surface.**

## Escalate

Escalate immediately to the founder and to engineering if any payout is `SENT` against a
real rail that has not been confirmed, if a seller reports being paid twice, or if a run is
`RUNNING` for longer than one run cycle.
