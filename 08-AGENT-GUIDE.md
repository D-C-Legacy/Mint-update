# Agent Guide

**Read this first, on every ticket.**

This file is the contract between the human developer and any coding agent working on this repository.

---

## 1. Output mode: snippets only

**The agent does not create, edit or delete files. Ever.**

For every piece of code, the agent outputs:

````
**`src/modules/sales/domain/rules/increment.rule.ts`**  (new file)

```ts
// code here
```

> Computes the minimum next bid from a price-band table. Pure function, no I/O,
> so it can be unit tested without a database.
````

For a change to an existing file, state the location precisely:

````
**`src/modules/sales/application/sales.service.ts`**  (add method, after `startAuction`, around line 48)

```ts
// code here
```

> Public facade method other modules call to place a bid. Delegates to the use case.
````

Rules:
- Full path from repo root, always
- Say whether it is a new file, a replacement, or an insertion with a location
- One or two lines of plain explanation under each snippet, not a paragraph
- No "I've created the file" language. Nothing is created.
- If several files are needed, list them in dependency order: shared → domain → application → infra → api

---

## 2. Scope discipline

- **One ticket per session.** Do not start the next ticket because it seems related.
- **Only touch paths listed in the ticket's "Touches" column.** If the ticket cannot be completed without touching something else, stop and say so rather than expanding scope.
- **Do not refactor adjacent code.** If something nearby is wrong, note it in one line at the end and move on.
- **Do not add dependencies** that are not in `02-TRD.md` §1 without flagging it explicitly and explaining why.

---

## 3. Context budget

Load only:
1. This file
2. `04-FOLDER-STRUCTURE.md`
3. The docs listed in the ticket's "Context" line
4. Files inside the ticket's "Touches" paths

Do not read the whole `src` tree. Do not read other modules. If you need to know another module's shape, read only its `application/*.service.ts` facade, because that is the only thing you are allowed to call anyway.

---

## 4. Architecture rules the agent must never break

| Rule | Consequence if broken |
|---|---|
| `domain/` imports nothing from `application/`, `infra/` or `api/` | Domain becomes untestable, rules get tangled with I/O |
| Cross-module calls go through `application/*.service.ts` only | Modules fuse, extraction becomes a rewrite |
| Only `infra/repositories/` imports Prisma types | Prisma leaks into business logic |
| Money is `BigInt` minor units, never `number` | Rounding errors in real money |
| Ledger is append only, no UPDATE or DELETE | Audit trail destroyed, disputes unresolvable |
| Publish fanout **after** commit, never before | Clients see state that was rolled back |
| Every job idempotent | Double charges, double payouts |
| Zod validation at every boundary | Malformed input reaches domain logic |
| No business logic in controllers or gateways | Logic becomes untestable and duplicated |

---

## 5. Code style

```ts
// Use cases: one class, one public execute method
export class PlaceBidUseCase {
  constructor(
    private readonly sales: SaleRepositoryPort,
    private readonly tx: TransactionManager,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: PlaceBidCommand): Promise<Result<BidAccepted, BidRejected>> { ... }
}
```

- Named exports only. No default exports.
- Constructor injection. No service locators, no module-level singletons.
- `Result<T, E>` for expected failures (bid too low, out of stock). Throw only for genuinely unexpected conditions.
- Zod schema and its inferred type live together:
  ```ts
  export const PlaceBidSchema = z.object({ amount: z.bigint().positive(), clientRef: z.string().max(64) });
  export type PlaceBidDto = z.infer<typeof PlaceBidSchema>;
  ```
- Domain errors extend `DomainError` and carry a code from the central registry.
- No `any`. No non-null assertion `!` without a comment justifying it.
- Async everywhere. No `.then()` chains.

---

## 6. Test expectations

Every domain rule ships with its test in the same session:

```
src/modules/sales/domain/rules/anti-snipe.rule.ts
src/modules/sales/domain/rules/anti-snipe.rule.spec.ts   ← required
```

Domain tests use no database, no Redis, no mocks beyond the `Clock` port.

For use cases, mock the ports. For repositories, integration test against Testcontainers Postgres.

---

## 7. What to do when blocked

Stop and say so. Specifically:

- **Ambiguous requirement:** state the ambiguity, state the two readings, recommend one, and wait.
- **Needs a file outside scope:** name the file and why, and wait.
- **The doc contradicts itself:** quote both lines and ask.
- **A rule in §4 would have to be broken:** do not break it. Explain what the ticket would need instead.

Never invent a schema field, an endpoint, or an event name that is not in the docs. If something is missing, that is a gap to report, not a gap to fill silently.

---

## 8. Commit convention

The human commits, but the agent should suggest the message:

```
feat(sales): add anti-snipe extension rule

Implements AntiSnipeRule computing the new end time from now rather than
the previous end time, with a max extension cap.

Ticket: P5-03
```

Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `perf`.

---

## 9. Ticket prompt template

Copy this for each ticket:

```
Read: docs/08-AGENT-GUIDE.md, docs/04-FOLDER-STRUCTURE.md
Also read: <Context docs from the ticket>
Work only inside: <Touches paths from the ticket>

Ticket: <ID> <Title>

Deliverables:
<paste from 07-IMPLEMENTATION-PLAN.md>

Acceptance:
<paste from the phase's acceptance block>

Output snippets only, with full file paths and a one line note per snippet.
Do not create or modify files. Do not start any other ticket.
```

---

## 10. Quick reference

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
| Why something was chosen | `09-DECISIONS.md` |
