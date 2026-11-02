# Load tests (`test/load/`)

k6 scripts for the five scenarios in `06-REALTIME-AND-CONCURRENCY.md` §12. Each script's own
header comment quotes its scenario's target row and documents the design decisions specific to
it; this file covers what's shared across all five.

## Known limitation: no staging environment exists yet

05-API-SPEC §12's own wording is "run against staging" — but no ticket anywhere in this
65-ticket build provisions a staging environment (no `docker-compose.yml` profile, nothing in
`.env.example`, nothing in `07-IMPLEMENTATION-PLAN.md`). These scripts are staging-ready (every
VU count/rate is env-var driven, defaulting small for a local smoke run and documented per
script with the `-e` flags for the real target scale) but have only ever been run and proven
locally. Flagged in `PROGRESS.md`/`MEMORY.md` — do not read a passing local smoke run as proof
the real NFRs (5,000 viewers, 20 bids/s, etc.) hold at real scale.

## Prerequisites

- k6 itself is not an npm dependency (it's a standalone binary/Docker image, per `02-TRD.md` §1).
  Either install it, or run every `k6 run ...` command below via
  `docker run --rm -i --network host -v "$PWD/test/load:/scripts" grafana/k6 run /scripts/<file>`
  (adjust the mounted path/working directory to taste).
- Real Postgres + Redis reachable, and the real `api`/`realtime` processes booted (same
  Docker-remap-ports-and-temp-`.env` ritual as every other verification in this build).
- Seed fixtures once per run against a given database:
  ```
  LOAD_TEST_ROOMS=3 LOAD_TEST_BUYERS=300 npx ts-node test/load/seed.ts
  ```
  Writes `test/load/.output/fixtures.json` (gitignored — holds real signed JWTs). Re-run with
  larger `LOAD_TEST_ROOMS`/`LOAD_TEST_BUYERS` before a real staging-scale run.

## Running a scenario

```
k6 run test/load/scenario-1-viewers-bid-fanout.js
```

Every script reads `API_BASE_URL`/`REALTIME_WS_URL` from `-e` flags (defaults:
`http://localhost:3000` / `ws://localhost:3001`, this repo's documented dev ports — override to
match whatever ports the processes under test are actually listening on, e.g. this build's own
remapped local-verification ports, or a real staging host) and a scenario-specific `VUS`/rate env
var documented in that script's header. `FIXTURES_PATH` overrides the fixtures file location.

## What's deliberately not automated

- **Seeding bypasses the real seller-onboarding/stream-start use cases** (`seed.ts`'s own header
  explains why: those flows aren't what this ticket tests, and looping them for thousands of
  rooms would make seeding the bottleneck, not the thing being load-tested).
- **Scenario 5 does not trigger its own node restart.** No deployment/process-restart mechanism
  exists anywhere in this build to call programmatically — restart the real process (or
  container, or pod, depending on environment) by hand partway through the run.
- **No automated "stable memory" pass/fail.** Scenario 2 samples the realtime process's own
  `/metrics` (`process_resident_memory_bytes`) throughout the run as a Trend for a human to
  eyeball afterward — no doc gives an acceptable growth curve to assert against automatically.
