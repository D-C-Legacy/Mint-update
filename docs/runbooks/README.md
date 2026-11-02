# Runbooks

Operational procedures for the live commerce backend. Each runbook states what the system does
today, not what the spec intends. Where a step depends on something that does not exist yet,
the runbook says so under **Known gaps** and does not assume it.

| Runbook | Use when |
|---|---|
| [stuck-auction.md](stuck-auction.md) | An auction is past its end time and still shows as open |
| [failed-payout.md](failed-payout.md) | A payout run or payout is marked failed, or a seller reports missing money |
| [reconciliation-mismatch.md](reconciliation-mismatch.md) | The nightly ledger reconciliation reports a mismatch |
| [provider-outage.md](provider-outage.md) | Stripe, LiveKit, Resend, Expo push, Redis or Postgres is down or degraded |
| [rollback.md](rollback.md) | A deploy must be reverted |

## Ground rules for every runbook

- **The ledger is append-only.** Never `UPDATE` or `DELETE` a ledger row or a bid row, in
  production or anywhere else. A money error is corrected with a new, compensating entry.
- **Admin routes need an admin JWT.** Every `/admin/*` call below requires one. Mutating
  admin calls are audit-logged.
- **Money-moving admin calls take an `Idempotency-Key` header.** Retrying the same key with the
  same body replays the stored response. Reusing a key with a different body returns 409.
- **Alerts** are logged at CRITICAL by `AlertingService` and emailed to `ALERT_EMAIL_TO` when
  that is set. Each condition is deduplicated for `ALERT_COOLDOWN_MINUTES` (default 15). A
  recurring alert after the cooldown means the condition is still true.
- **Escalate money decisions to the founder.** Any step that moves, holds, reverses or
  re-issues money is a decision for a person, not an automated response.

## Processes

The backend runs as three Node processes built from one codebase:

- **api**: HTTP, `dist/main.api.js`, port `API_PORT`
- **realtime**: Socket.IO, `dist/main.realtime.js`, port `REALTIME_PORT`
- **worker**: BullMQ jobs and periodic sweeps, `dist/main.worker.js`, metrics on
  `WORKER_METRICS_PORT`

Each process exposes `/metrics` for Prometheus scraping. The api and realtime processes serve
it over HTTP. The worker serves it from a small standalone server.

Scheduled sweeps that these runbooks rely on:

| Job | Queue | Cadence | Purpose |
|---|---|---|---|
| `auction.sweep` | sales | every 10 s | closes OPEN auctions past `endsAt` |
| `stream.reconcile` | streaming | every minute | checks LIVE sessions against the provider |
| `ledger.reconcile` | ledger | every 24 h | checks ledger balances |
| `alerting.sweep` | alerting | every `ALERT_SWEEP_INTERVAL_MS` | queue depth, job failure rate, webhook lag, bid latency |
