# Folder Structure

**Last updated:** 2026-09-29

Domain-driven modular monolith. One module per bounded context, four layers inside each.

---

## 1. Top level

```
.
├── docs/                        # these documents
├── prisma/
│   ├── schema/                  # split schema files, merged on generate
│   │   ├── schema.prisma        # datasource, generator, enums
│   │   ├── identity.prisma
│   │   ├── sellers.prisma
│   │   ├── catalog.prisma
│   │   ├── channels.prisma
│   │   ├── streaming.prisma
│   │   ├── chat.prisma
│   │   ├── sales.prisma
│   │   ├── orders.prisma
│   │   ├── payments.prisma
│   │   ├── ledger.prisma
│   │   └── payouts.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.api.ts              # entry: HTTP process
│   ├── main.realtime.ts         # entry: WebSocket process
│   ├── main.worker.ts           # entry: BullMQ process
│   ├── app.module.ts            # root module, imports all
│   ├── config/
│   ├── shared/
│   ├── platform/
│   └── modules/
├── test/
│   ├── integration/
│   ├── e2e/
│   └── load/                    # k6 scripts
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
└── CLAUDE.md                    # agent rules, see 08-AGENT-GUIDE.md
```

---

## 2. `src/config`

Environment and feature configuration. Validated once at boot.

```
src/config/
├── env.schema.ts          # Zod schema for all env vars
├── env.ts                 # parsed, typed, frozen export
├── app.config.ts          # port, cors, version
├── database.config.ts
├── redis.config.ts
├── auth.config.ts         # token TTLs, argon params
├── stripe.config.ts
├── storage.config.ts      # buckets, CDN domain
├── stream.config.ts       # video provider keys
└── sales.config.ts        # default auction duration, anti-snipe window, increment table
```

---

## 3. `src/shared`

Pure, dependency-free utilities. No I/O, no Nest decorators, importable from anywhere including `domain` layers.

```
src/shared/
├── money/
│   ├── money.ts              # BigInt minor-unit helpers, add, sub, percentage
│   └── currency.ts
├── result/
│   └── result.ts             # Result<T, E> for expected failures
├── errors/
│   ├── domain-error.ts       # base class
│   └── error-codes.ts        # enum of every code, mapped at the edge
├── ids/
│   └── id.ts                 # ULID generation, typed id branding
├── time/
│   └── clock.ts              # Clock port so tests control time
├── events/
│   ├── domain-event.ts       # base shape { name, version, occurredAt, payload }
│   └── event-bus.port.ts
├── pagination/
│   └── cursor.ts
└── types/
    └── branded.ts            # UserId, SellerId, AuctionId as branded strings
```

---

## 4. `src/platform`

Technical infrastructure shared by all modules. Wraps a library so modules never import the library directly.

```
src/platform/
├── database/
│   ├── prisma.service.ts
│   ├── transaction.manager.ts   # runs a unit of work, used by app layer
│   └── database.module.ts
├── redis/
│   ├── redis.service.ts
│   ├── pubsub.service.ts
│   ├── lock.service.ts          # redlock-style advisory locks
│   └── redis.module.ts
├── queue/
│   ├── queue.service.ts         # enqueue, schedule, remove
│   ├── queue.names.ts
│   └── queue.module.ts
├── events/
│   ├── event-bus.service.ts     # in-process bus + Redis for cross-process
│   └── events.module.ts
├── storage/
│   ├── storage.service.ts       # S3 put, signed get
│   ├── storage.port.ts
│   └── storage.module.ts
├── logger/
│   ├── logger.service.ts
│   └── logger.module.ts
├── idempotency/
│   ├── idempotency.service.ts
│   ├── idempotency.guard.ts
│   └── idempotency.module.ts
├── ratelimit/
│   ├── rate-limit.service.ts    # Redis token bucket
│   └── rate-limit.guard.ts
├── auth/
│   ├── jwt.service.ts
│   ├── jwt.guard.ts
│   ├── roles.guard.ts
│   ├── ws-auth.guard.ts
│   └── auth.module.ts
└── observability/
    ├── tracing.ts
    ├── metrics.ts
    └── observability.module.ts
```

---

## 5. `src/modules` — the shape every module follows

Take `sales` as the reference. Every other module mirrors this.

```
src/modules/sales/
├── sales.module.ts
│
├── domain/                          # PURE. No Prisma, no Nest, no I/O.
│   ├── entities/
│   │   ├── auction.entity.ts        # state machine + invariants
│   │   ├── bid.entity.ts
│   │   ├── offer.entity.ts
│   │   └── sale-item.entity.ts
│   ├── value-objects/
│   │   ├── bid-amount.vo.ts
│   │   ├── increment-table.vo.ts
│   │   └── sale-mode.vo.ts
│   ├── rules/
│   │   ├── bid-validation.rule.ts   # is this bid legal
│   │   ├── anti-snipe.rule.ts       # should the timer extend
│   │   └── increment.rule.ts        # minimum next bid
│   ├── errors/
│   │   └── sales.errors.ts
│   └── ports/
│       ├── auction.repository.port.ts
│       ├── bid.repository.port.ts
│       └── offer.repository.port.ts
│
├── application/                     # orchestration, one file per use case
│   ├── commands/
│   │   ├── start-auction.usecase.ts
│   │   ├── place-bid.usecase.ts
│   │   ├── close-auction.usecase.ts
│   │   ├── buy-now.usecase.ts
│   │   ├── submit-offer.usecase.ts
│   │   ├── respond-to-offer.usecase.ts
│   │   └── cancel-sale.usecase.ts
│   ├── queries/
│   │   ├── get-auction-state.query.ts
│   │   └── list-room-sales.query.ts
│   └── sales.service.ts             # PUBLIC FACADE. Other modules call only this.
│
├── infra/
│   ├── repositories/
│   │   ├── auction.prisma.repository.ts
│   │   ├── bid.prisma.repository.ts
│   │   └── offer.prisma.repository.ts
│   ├── jobs/
│   │   └── auction-close.processor.ts
│   └── mappers/
│       └── auction.mapper.ts        # Prisma row <-> domain entity
│
├── api/
│   ├── http/
│   │   ├── sales.controller.ts
│   │   └── dto/
│   │       ├── start-auction.dto.ts
│   │       └── submit-offer.dto.ts
│   └── ws/
│       ├── sales.gateway.ts
│       └── events/
│           ├── inbound.events.ts    # bid.place, offer.submit
│           └── outbound.events.ts   # bid.accepted, sale.resolved
│
└── events/
    ├── published/
    │   ├── sale-resolved.event.ts
    │   └── auction-extended.event.ts
    └── handlers/
        └── on-stream-ended.handler.ts   # cancels open sales in that room
```

### The full module list

```
src/modules/
├── identity/
├── sellers/
├── catalog/
├── channels/
├── streaming/
├── chat/
├── sales/          ← core domain, most complex
├── orders/
├── payments/
├── ledger/         ← second most critical, strictest invariants
├── payouts/
├── notifications/
└── admin/
```

---

## 6. Why this structure

| Property | How it is achieved |
|---|---|
| **An agent does not lose context** | To change bid rules, open one folder: `modules/sales/domain/rules/`. Nothing else needs loading. |
| **Business rules are testable without a database** | `domain/` is pure. Unit tests run in milliseconds. |
| **Swapping a vendor is one file** | Ports in `domain/ports`, adapters in `infra/`. Replace the adapter. |
| **Modules cannot quietly couple** | Only `application/*.service.ts` is exported from a module. Enforced by lint rule. |
| **Extraction to a service is mechanical** | A module already has its own domain, storage access and API. Lift the folder, add HTTP between. |

---

## 7. Lint rules that enforce the boundaries

Add to `.eslintrc`:

```js
// no cross-module deep imports
'no-restricted-imports': ['error', {
  patterns: [
    {
      group: ['**/modules/*/domain/**', '**/modules/*/infra/**', '**/modules/*/api/**'],
      message: 'Import another module only through its application/*.service.ts facade.'
    },
    {
      group: ['@prisma/client'],
      message: 'Only infra/repositories may import Prisma types.'
    }
  ]
}]
```

Plus a dependency-cruiser rule forbidding `domain → infra` and `domain → application`.

---

## 8. Naming conventions

| Kind | Pattern | Example |
|---|---|---|
| Use case | `verb-noun.usecase.ts` | `place-bid.usecase.ts` |
| Entity | `noun.entity.ts` | `auction.entity.ts` |
| Value object | `noun.vo.ts` | `bid-amount.vo.ts` |
| Port | `noun.port.ts` | `auction.repository.port.ts` |
| Adapter | `noun.<tech>.<kind>.ts` | `auction.prisma.repository.ts` |
| Domain event | `noun-verb.event.ts` | `sale-resolved.event.ts` |
| Job processor | `noun-verb.processor.ts` | `auction-close.processor.ts` |
| Test | mirrors source + `.spec.ts` | `bid-validation.rule.spec.ts` |
