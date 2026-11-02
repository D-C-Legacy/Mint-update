# Rollback

Revert a deploy after a bad release. Read the **limits** section first. A rollback restores
code. It does not undo data, money or events the bad release already wrote.

## What is deployed

- One Docker image set from the repo `Dockerfile`, with three targets: `api`
  (`dist/main.api.js`), `realtime` (`dist/main.realtime.js`) and `worker`
  (`dist/main.worker.js`). Each process runs from the same built `dist/` tree.
- Database schema from `prisma/migrations/`, applied forward only.
- The repo contains **no CI/CD or deployment configuration.** How the images are built, pushed
  and rolled out is set up outside this repository. Use that environment's own rollback
  mechanism, and record it here once it is written down.

## Limits: what a rollback cannot undo

1. **Database migrations are forward-only.** Every migration folder holds one `migration.sql`
   and there are no down scripts. Rolling back code does not roll back the schema. An older
   build must run against the newer schema. Only additive migrations are safe to leave in
   place under an older build. If a migration dropped or renamed a column the older build
   reads, rolling back will break that build.
2. **The ledger is append-only.** A bad release that posted money entries leaves them in place.
   Rolling back does not remove them. Correct them forward (see `reconciliation-mismatch.md`).
3. **Bids and order state are append-only in practice.** Accepted bids and completed status
   transitions stay accepted. A rollback does not reopen them.
4. **Events already published stay published.** Cross-process events and webhook-driven work
   that a bad build started may be half-done. Check the queues before you assume nothing ran.
5. **No documented backup restore procedure exists in the repo.** The architecture document
   states managed Postgres with automated backups and point-in-time recovery. That is an intent
   for production infrastructure, not a verified procedure. Do not promise a restore to a
   specific minute until someone has tested it.

## Procedure

1. **Decide whether a rollback is the right fix.** If the bad release is additive and the
   damage is contained, a fix-forward may be faster. If it is writing wrong money or wrong bid
   state, stop the damage first.
2. **Stop new money and new bids from the bad build.** Money and sweep jobs run in the worker,
   so it is the first process to roll back. If bids themselves are wrong, take the api and
   realtime processes off traffic too, before rolling them back.
3. **Check the queues for jobs the bad build enqueued.** Jobs carry the payload shape of the
   version that enqueued them. An older worker may fail on a newer payload. A failed job can be
   inspected and re-run after the rollback, but do not blindly re-run money jobs.
4. **Roll back in this order:** worker, then realtime, then api. Verify each process is healthy
   before moving on. Health is `GET /health/ready` on api and realtime, and `/metrics` on all
   three.
5. **Confirm the schema is compatible.** Run the older build's read paths against a staging
   copy of the current schema if you can. If you cannot, check that no migration since the
   older build removed or renamed anything it reads.
6. **Verify.** Check the alerts are quiet, `job_failures_total` is not climbing, and the
   stuck-auction query in `stuck-auction.md` returns no rows.
7. **Record the rollback.** Note the version rolled back from and to, when, and why. Note any
   money or bid state that needs forward correction, and hand it to the founder.

## Known gaps

- **No automated rollback exists in this repo.** Every step above is manual.
- **No pre-deploy migration check or backward-compatibility test exists** to tell you whether an
  older build can run on the current schema.
- **No tested database restore.** See limit 5.

## Escalate

Escalate to the founder before any rollback that has already written money or bid state, and
before any restore from backup.
