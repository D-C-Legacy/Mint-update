# Provider outage

A third-party or infrastructure dependency is down or degraded. This runbook covers each one,
what breaks, and what still works.

Start by identifying which dependency is failing. Then use the matching section.

## Stripe (payments and webhooks)

**What breaks:** taking payment for an order (`POST /v1/orders/:id/pay` creates a PaymentIntent
through Stripe), refunds, and processing of incoming webhook events.

**What still works:** browsing, bidding and chat (no Stripe call on those paths). Stripe
webhook **delivery** still works while the processor is down, because the endpoint only
records and enqueues. Nothing is lost on ingestion.

**Signal:** the webhook-lag alert fires when a `WebhookEvent` has been waiting unprocessed for
`ALERT_WEBHOOK_LAG_THRESHOLD_SECONDS` (default 300). Failed Stripe calls appear as errors on
the pay and refund routes.

**Act:**

1. Check the Stripe status page and your own test-mode and live-mode dashboards. Do not assume
   the outage is on Stripe's side until you have checked.
2. Pay attempts that failed mid-call are safe to retry with the same `Idempotency-Key`. An
   unexpected failure releases the key, so a retry re-attempts the operation rather than
   replaying an error. A deterministic failure (an order in the wrong state) is stored and
   replayed. Tell customers to retry, and retry through the same key.
3. Do not manually mark orders paid. Payment confirmation is meant to come from webhooks, and
   a manual change would skip the ledger path.
4. When Stripe recovers, webhooks already recorded will be processed. Stripe normally retries
   deliveries it could not make, but check the Stripe dashboard for any events that never
   reached `/webhooks/stripe`. Confirm the webhook-lag alert clears.

**Known gap (critical, read before any Stripe incident):** the webhook processor records each
event as processed, but **it does not yet apply any event to an order, a payment or the
ledger.** The per-event dispatch (`payment_intent.succeeded`, `charge.refunded`, and the rest)
is a documented TODO in `modules/payments/infra/jobs/stripe-webhook.processor.ts`, waiting on
the payment and ledger work. Until it lands, a payment that succeeds at Stripe does not
automatically mark its order paid. Any Stripe incident therefore needs a manual check of
Stripe's records against orders, and the founder must be told.

## LiveKit (live video)

**What breaks:** starting a stream (creating the video room and publish token), and minting
viewer tokens.

**What still works:** chat, bidding and the Socket.IO fanout, because those depend on the
realtime process and Redis, not LiveKit.

**Signal:** the reconcile job (`stream.reconcile`, every minute) fails. Start-stream calls
return errors.

**Act:**

1. Check LiveKit's status and your deployment. Confirm `LIVEKIT_URL` and the key pair.
2. Do not restart streams that are already LIVE. They need no action while the video layer
   is down.

**Known risk:** the reconcile job ends any LIVE session whose provider room is reported
missing. Network errors make the job fail without ending anything. But if LiveKit ever answers
"no rooms" when rooms actually exist, live sessions end for real. If streams end during a
LiveKit incident and the room still exists at the provider, treat it as this failure mode and
escalate.

## Resend (email)

**What breaks:** all transactional email, including **the alert emails themselves.**

**What still works:** alerting still writes CRITICAL log lines. Without email, the alert
reaches humans only through whoever is reading the logs.

**Act:** check Resend's status and `RESEND_API_KEY` / `RESEND_FROM_EMAIL`. During a Resend
outage, watch the logs directly for `CRITICAL` lines and do not rely on email alone.

## Expo push (mobile notifications)

**What breaks:** push notifications to the app.

**What still works:** everything else. Notifications are not on any money path.

**Act:** check Expo's status. The push adapter invalidates tokens Expo reports as dead. I did
not verify a retry path for pushes that fail during an outage, so assume they are lost. Tell
the founder if customers report missing alerts for a live auction.

## Redis

**What breaks (per `06-REALTIME-AND-CONCURRENCY.md` §11):** cross-node Socket.IO fanout stops,
so a viewer on one node misses events from another. Queues, sweeps and the alerting cooldown
lock also stop, because they all run on Redis.

**What still works:** bids still persist in Postgres. Sockets keep working on each node
individually.

**Act:**

1. Restore Redis first. Almost everything else depends on it.
2. Expect stuck auctions while the worker cannot reach its queue. Once Redis is back, the
   10-second `auction.sweep` catches up on its own. See `stuck-auction.md` to confirm.
3. Expect alerts to be unreliable until Redis is back. The alerting job is itself stored in
   Redis.

## Postgres

**What breaks:** all writes. Bids are rejected, not accepted. Per §11, the system must never
accept a bid it cannot record.

**Act:** restore Postgres. Bidding resumes once connections succeed. Confirm no bid was
reported to a buyer as accepted during the outage. An accepted-then-lost bid is a serious
defect; escalate immediately if it is suspected.

## Escalate

Escalate to the founder and engineering for any outage longer than the time it takes to
restart the dependency, and for any sign that a money event, a bid or a stream state was
written inconsistently during the incident.
