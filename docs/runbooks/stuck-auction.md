# Stuck auction

An auction (`Sale` with `mode = AUCTION`) is still `OPEN` after its `endsAt` has passed. Bids
are rejected or the sale never resolves, and no winner is announced.

## How the system closes auctions

Two mechanisms close an auction. Both schedule the same close job, so they are idempotent with
each other:

1. **Scheduled close job.** When a bid lands near the end, the close job is rescheduled to the
   new `endsAt`. The job id is `close-<saleId>`, produced by `auctionCloseJobId()` in
   `modules/sales/application/commands/place-bid.usecase.ts`. Never build this id by hand.
2. **`auction.sweep`.** Runs every 10 seconds. It finds every `OPEN` sale past `endsAt` and
   schedules a close job for it with delay 0.

A closed sale becomes `RESOLVED` (with a winner) or `EXPIRED` (no bids). A failed close leaves
the sale `OPEN`. The sweep retries it on its next tick.

## Confirm

1. Find the sale. Tables are named after the Prisma models (there are no `@@map` directives).
   Read-only query:
   ```sql
   SELECT id, status, "endsAt", "currentAmount", "currentBidId"
   FROM "Sale"
   WHERE status = 'OPEN' AND "endsAt" < now()
   ORDER BY "endsAt";
   ```
   If the query returns nothing, the auction is not stuck. The problem is on the client side.
2. Check the sweep is alive. Look for recent `job.process sales.auction.sweep` spans or log
   lines from the worker. A worker that has stopped means nothing closes anything. Check the
   worker process first.
3. Check for failed close jobs. A rising `job_failures_total{queue="sales"}` metric, or an
   alert from the job-failure-rate condition, means the close job is throwing.

## Act

1. **Worker down.** Restart the worker process. The repeating sweep resumes on its own. Within
   10 seconds it reschedules close jobs for every expired open sale. Confirm the stuck rows
   drop out of the query above.
2. **Close job throwing for one sale.** Read the failing job's error in the worker logs
   (`job-wrapper` logs the failure and reports it to Sentry if configured). Fix the cause in
   code, deploy, and let the sweep retry. Do not edit the `Sale` row.
3. **Close succeeds but the wrong winner is shown.** Treat this as a money dispute. Escalate.
   Do not modify bids. The `Bid` table is append-only in practice.

## Known gaps

- **BullMQ jobs have no retry or backoff configured.** `QueueService` adds jobs with no
  `attempts` or `backoff` options, so a failed close job is not retried by BullMQ itself.
  Recovery depends entirely on the 10-second sweep. The spec (`06-REALTIME-AND-CONCURRENCY.md`
  §11) says "retries with backoff, alert after 3 failures." Neither the retry nor the
  3-failure alert exists. The generic job-failure-rate alert fires only at 5 failures in
  15 minutes.
- **No admin route closes or resolves a sale.** There is no manual override. An operator who
  needs a sale closed by hand has no supported path today.
- **The sweep only looks at `OPEN` sales.** A sale stuck in `CLOSING` would never be picked up.
  The current design never writes `CLOSING` (see the P5-07 decision in `MEMORY.md`). If one
  ever appears, that is a code defect, not an operational state.

## Escalate

Escalate to engineering if the sweep is running and the query still returns rows after one
sweep tick, or if a sale's winner or amount looks wrong.
