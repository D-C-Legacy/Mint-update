# AGENTS.md — Live Commerce Platform Backend

**One-liner:** Live video shopping backend — sellers broadcast, buyers bid/buy in real time. Modular monolith, three processes (api / realtime / worker).

**Current phase:** P0 — Skeleton. **Current ticket:** P0-01. See `PROGRESS.md` for live status.

---

## 1. Session protocol (do this every session, in order)

1. Read this file (`AGENTS.md`)
2. Read `PROGRESS.md` → find current ticket
3. Read `MEMORY.md`
4. Read only the docs listed on that ticket's Context line in `07-IMPLEMENTATION-PLAN.md`
5. State one line: `Resuming at <ticket id>: <title>. Reading <docs>.`
6. Work only inside the ticket's Touches paths
7. At end of ticket, output: updated `PROGRESS.md` rows + header, new `MEMORY.md` entries (or "no memory entries"), a suggested commit message, next ticket id + what it needs
8. **Never start the next ticket in the same session** unless explicitly told to

---

## 2. Output rule — snippets only, no exceptions

**The agent never creates, edits, or deletes files. Ever. Output snippets only.**

Format for every piece of code:

**`src/modules/sales/domain/rules/increment.rule.ts`** — NEW FILE

```ts
// code
```

> One or two lines: what this does and why it lives here.

For changes to existing files:

**`src/modules/sales/application/sales.service.ts`** — ADD METHOD after `startAuction()` (~line 48)

Rules:
- Always the full path from repo root
- Always say NEW FILE / REPLACE FILE / ADD AFTER `<anchor>` / REPLACE LINES `<range>`
- One or two lines of plain explanation per snippet, never a paragraph
- Multiple files go in dependency order: shared → domain → application → infra → api
- Never say "I've created" or "I've updated" — nothing is created

---

## 3. Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 22 LTS, TypeScript 5.6 strict |
| Framework | NestJS 10 + Fastify adapter |
| Database | PostgreSQL 16 + Prisma 5.20+ |
| Cache/pubsub/presence | Redis 7 + ioredis 5 |
| Realtime | Socket.IO 4 + @socket.io/redis-adapter |
| Jobs | BullMQ 5 |
| Payments | Stripe SDK (charges only, not Connect) |
| Media | AWS SDK v3 (S3) + CloudFront |
| Video | LiveKit Cloud or Amazon IVS, behind `StreamProviderPort` (D-005 open) |
| Validation | Zod at every boundary |
| Auth | argon2id, JWT (short access + rotating refresh) |
| Logging/tracing/errors | Pino, OpenTelemetry, Sentry |
| Testing | Vitest, Testcontainers, k6 |
| Tooling | pnpm 9+, ESLint + Prettier, Husky + lint-staged |

---

## 4. Architecture rules — never break these

| Rule | Consequence if broken |
|---|---|
| `domain/` imports nothing from `application/`, `infra/` or `api/` | Domain becomes untestable, rules tangle with I/O |
| Cross-module calls go through `application/*.service.ts` only | Modules fuse, extraction becomes a rewrite |
| Only `infra/repositories/` imports Prisma types | Prisma leaks into business logic |
| Money is `BigInt` minor units, never `number` | Rounding errors in real money |
| Ledger is append only, no UPDATE or DELETE | Audit trail destroyed, disputes unresolvable |
| Publish WS fanout **after** commit, never before | Clients see state that was rolled back |
| Every background job is idempotent | Double charges, double payouts |
| Zod validation at every boundary | Malformed input reaches domain logic |
| No business logic in controllers or gateways | Logic becomes untestable and duplicated |

If a ticket seems to require breaking one of these: **stop, explain what would need to break, wait.** Do not invent a workaround.

---

## 5. Module list (each follows the same 4-layer shape)

```
identity, sellers, catalog, channels, streaming, chat,
sales (core, most complex), orders, payments,
ledger (2nd most critical), payouts, notifications, admin
```

Each module:
```
<module>/
  domain/        entities, value-objects, rules, errors, ports   — PURE, no I/O
  application/   commands/, queries/, <module>.service.ts        — PUBLIC FACADE
  infra/         repositories, jobs, mappers                     — Prisma lives only here
  api/           http/ (controllers, dto), ws/ (gateway, events)
  events/        published/, handlers/
  <module>.module.ts
```
Dependency direction: `api → application → domain`; `infra` implements ports declared in `domain`/`application`.

---

## 6. Naming conventions

| Kind | Pattern | Example |
|---|---|---|
| Use case | `verb-noun.usecase.ts` | `place-bid.usecase.ts` |
| Entity | `noun.entity.ts` | `auction.entity.ts` |
| Value object | `noun.vo.ts` | `bid-amount.vo.ts` |
| Port | `noun.port.ts` | `auction.repository.port.ts` |
| Adapter | `noun.<tech>.<kind>.ts` | `auction.prisma.repository.ts` |
| Domain event | `noun-verb.event.ts` | `sale-resolved.event.ts` |
| Job processor | `noun-verb.processor.ts` | `auction-close.processor.ts` |
| Test | source + `.spec.ts` | `bid-validation.rule.spec.ts` |

---

## 7. Code style

- Named exports only. No default exports.
- Constructor injection. No service locators, no module-level singletons.
- `Result<T, E>` for expected failures (bid too low, out of stock). Throw only for genuinely unexpected conditions.
- Zod schema and inferred type live together:
  ```ts
  export const PlaceBidSchema = z.object({ amount: z.bigint().positive(), clientRef: z.string().max(64) });
  export type PlaceBidDto = z.infer<typeof PlaceBidSchema>;
  ```
- Domain errors extend `DomainError`, carry a code from the central registry.
- No `any`. No non-null assertion `!` without a comment justifying it.
- Async everywhere, no `.then()` chains.
- Every domain rule ships with its `.spec.ts` in the same session. Domain tests: no DB, no Redis, no mocks beyond the `Clock` port.

---

## 8. Scope discipline

- One ticket per session. Do not drift into the next one.
- Touch only the paths in the ticket's "Touches" column.
- Do not refactor adjacent code — note it in one line at the end instead.
- Do not add dependencies outside `02-TRD.md` §1 without flagging it first.
- Never invent a schema field, endpoint, or event name not in the docs. A gap is reported, not filled silently.

---

## 9. When blocked, stop and ask

- **Ambiguous requirement:** state the ambiguity, the two readings, recommend one, wait.
- **Needs a file outside scope:** name it and why, wait.
- **Docs contradict each other:** quote both lines, ask.
- **A §4 rule would have to break:** do not break it. Explain what the ticket would need instead.

---

## 10. Doc routing table

| I need to know… | Read |
|---|---|
| What the product does | `00-PRD.md` |
| How the system is shaped | `01-ARCHITECTURE.md` |
| Which library, which rule | `02-TRD.md` |
| A table or column | `03-DATA-MODEL.md` |
| Where a file goes | `04-FOLDER-STRUCTURE.md` |
| An endpoint or event name | `05-API-SPEC.md` |
| Bid concurrency, timers, presence | `06-REALTIME-AND-CONCURRENCY.md` |
| What to build next | `07-IMPLEMENTATION-PLAN.md` |
| Rules for me (this doc) | `08-AGENT-GUIDE.md` |
| Why something was chosen | `09-DECISIONS.md` |
