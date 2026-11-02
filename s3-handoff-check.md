# s3-handoff-check.md: OpenCode's S3/storage work, status after it crashed on rate limiting (local-only, never committed)

**Context**: handed off S3 storage integration to OpenCode (see `prompt.md` §9/§2 and the handoff
prompt given in chat 15 Oct 2026). It crashed from rate limiting before finishing. **Nothing was
committed** — everything below is sitting uncommitted in the working tree (`git status` confirms:
`main` still at `f8a02ba`, matches `origin/main`). No Prisma schema changes (`git diff --stat --
prisma/` is empty) — no migration concern.

**This file is a partial check, stopped mid-way on the user's request** — pick up from here, don't
re-start from scratch.

## What OpenCode built (backend only, no frontend wiring seen yet — check this)

- `src/platform/storage/upload-policy.ts` (new) — `assertImageUpload`/`assertDocumentUpload`,
  mime-type allowlists (images incl. HEIC/HEIF, documents incl. PDF), 10MB caps, returns `Result`
  not throw. Read in full — clean, well-commented, correct.
- `src/modules/catalog/domain/rules/product-status-transition.rule.ts` (+ its own `.spec.ts`, new)
  — table-driven DRAFT↔ACTIVE transition rule, explicitly mirrors an existing
  `seller-status-transition.rule.ts` pattern. This is the fix for the real gap flagged in
  `prompt.md` §9/§6c: there was no way to move a product from DRAFT to ACTIVE at all.
- `src/modules/catalog/application/commands/set-product-status.usecase.ts` (new) — publish/
  unpublish a product. **Publishing requires at least one attached image** (`ProductNotPublishableError`)
  — ⚠️ **the code comment attributes this rule to "the founder's rule," but I cannot find this
  confirmed anywhere in `founder_requests.md` or any other doc. This may be OpenCode's own
  reasonable-sounding assumption written as if it were a confirmed fact — verify with the user/
  founder before trusting that comment, don't just take it at face value.** The rule itself is a
  sensible product decision either way (makes the storage/publish work meaningfully connected), just
  the attribution needs checking.
- New endpoints on `catalog.controller.ts`: `GET /products/:id/images`, `POST /products/:id/publish`,
  `POST /products/:id/unpublish`.
- Seller document upload flow touched: `sellers.controller.ts`, `request-document-upload.usecase.ts`,
  `attach-document.usecase.ts`, `remove-document.usecase.ts`, new `list-my-documents.query.ts`.
- Channel banner upload: new `request-channel-banner-upload.usecase.ts` + its DTO, wired into
  `channels.controller.ts`/`channels.service.ts`/`channels.module.ts`.
- `storage.service.ts`, `storage.config.ts`, `env.schema.ts`, `.env.example` all touched — a new
  `PUBLIC_MEDIA_SCHEME` env var added (http for local MinIO, https for prod CloudFront/S3) — **this
  may be the fix for the real `https` vs local-`http` `getPublicUrl()` bug flagged in `prompt.md`
  §9 — confirm it actually fixes that, don't assume.**
- `identity/domain/entities/user.entity.ts`, `user.repository.port.ts`, `user.mapper.ts` touched —
  check what field was added (likely an avatar/photo key) and whether it's actually wired anywhere
  yet (controller/DTO) or just the domain layer so far.

## Confirmed broken right now (ran `npx tsc --noEmit -p .` at the backend root)

Exactly 2 errors, same root cause in both places — **the controller call sites don't pass
`sizeBytes` through to the use case, even though the Zod DTO already validates it and the use case
already requires it**:

1. `src/modules/catalog/api/http/catalog.controller.ts` — `requestImageUpload` (~line 111) builds
   `{ userId, productId, fileName, mimeType }` but not `sizeBytes`;
   `RequestImageUploadCommand` (in `request-image-upload.usecase.ts`) is missing a `sizeBytes:
number` field in its interface too (the use case body already reads `cmd.sizeBytes` at line ~58).
2. `src/modules/sellers/api/http/sellers.controller.ts` — `requestDocumentUpload` (~line 64) same
   issue; `RequestDocumentUploadCommand`'s interface **already has** `sizeBytes: number` declared
   correctly, so only the controller call site here needs `sizeBytes: dto.sizeBytes` added.

**This looks like the exact point OpenCode was cut off** — everything else checked so far is
complete and well-structured; this is unfinished wiring, not broken logic. Likely a ~10-minute fix:
add `sizeBytes: number` to `RequestImageUploadCommand`, and add `sizeBytes: dto.sizeBytes` to both
controller call sites. Re-run `npx tsc --noEmit -p .` after to confirm clean, then keep checking —
this was the first and only typecheck pass run; there may be more once these 2 are fixed.

## Not checked yet — pick up here

- Whether `catalog.module.ts`/`sellers.module.ts`/`channels.module.ts` actually register every new
  use case/query as a provider (saw they were touched, didn't verify completeness).
- Whether the frontend (`frontend/`) has any matching changes at all — `git status` in the repo root
  didn't show any `frontend/src/` files touched, so **the frontend side of this may not exist yet**,
  only backend. Confirm before assuming any UI work is needed next vs. already done.
- Full read of every new/changed file for AGENTS.md §4 architecture-rule compliance (domain purity,
  Prisma only in `infra/repositories/`, etc.) — spot-checked 3-4 files, all clean, but not
  exhaustive.
- Whether `docker-compose.prod.yml` needs `minio` (or real S3 env vars) re-added on EC2 — it was
  explicitly dropped earlier (`prompt.md` §13) since nothing called storage endpoints; that's no
  longer true once this ships.
