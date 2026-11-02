# Live Commerce Platform — Backend Documentation

**Last updated:** 2026-09-29

Live video shopping platform. Sellers broadcast, buyers watch, chat, bid and buy inside the stream.

---

## Read in this order

| # | Doc | What it answers |
|---|---|---|
| 00 | [PRD](./00-PRD.md) | What the product is, who uses it, what v1 includes |
| 01 | [Architecture](./01-ARCHITECTURE.md) | System shape, modules, critical paths, scaling |
| 02 | [TRD](./02-TRD.md) | Stack, versions, hard rules, testing, security |
| 03 | [Data Model](./03-DATA-MODEL.md) | Every table, enum, index and invariant |
| 04 | [Folder Structure](./04-FOLDER-STRUCTURE.md) | Where every file goes and why |
| 05 | [API Spec](./05-API-SPEC.md) | Endpoints, payloads, error codes, rate limits |
| 06 | [Realtime and Concurrency](./06-REALTIME-AND-CONCURRENCY.md) | WebSocket events, bid concurrency, timers, presence |
| 07 | [Implementation Plan](./07-IMPLEMENTATION-PLAN.md) | 65 tickets across 10 phases |
| 08 | [Agent Guide](./08-AGENT-GUIDE.md) | Rules for coding agents. Snippets only. |
| 09 | [Decisions](./09-DECISIONS.md) | ADRs and open items blocked on the founder |

---

## Stack at a glance

| Layer | Choice |
|---|---|
| Runtime | Node.js 22 LTS, TypeScript 5.6 strict |
| Framework | NestJS 10 with Fastify adapter |
| Database | PostgreSQL 16 + Prisma 5 |
| Cache, pub/sub, presence | Redis 7 + ioredis |
| Realtime | Socket.IO 4 + Redis adapter |
| Jobs | BullMQ 5 |
| Payments | Stripe (charges only, funds settle to the company account) |
| Media | S3 + CloudFront, separate private bucket for documents |
| Video | LiveKit or Amazon IVS, behind an adapter |
| Validation | Zod at every boundary |
| Testing | Vitest + Testcontainers + k6 |

---

## Architecture in one line

**Modular monolith, domain-driven, three processes:** `api` (HTTP), `realtime` (WebSocket), `worker` (jobs). One codebase, enforced module boundaries, independent scaling.

---

## The two parts that decide whether this works

1. **The sale engine** (`P5`) — simultaneous bids must produce exactly one winner, durably and auditably. See `06-REALTIME-AND-CONCURRENCY.md` §4.
2. **The ledger** (`P7`) — the platform holds other people's money. Double entry, append only, reconciled nightly. See `03-DATA-MODEL.md` §10.

Everything else is ordinary CRUD. Budget time accordingly.

---

## Blocking open item

**D-001: legal cover for holding and transmitting funds.** The ledger and payout design assumes the platform is legally able to hold buyer money and pay sellers. Licensing, KYC/AML, tax reporting and the seller agreement sit with the company. See `09-DECISIONS.md`.

---

## Starting work

```bash
pnpm install
docker compose up -d          # postgres, redis, minio
pnpm prisma migrate dev
pnpm db:seed
pnpm dev:api                  # or dev:realtime / dev:worker
```

Then take ticket `P0-01` from `07-IMPLEMENTATION-PLAN.md` and use the prompt template in `08-AGENT-GUIDE.md` §9.
