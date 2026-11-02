# deploy_progress.md: EC2 deployment tracker (Swish)

Tracks standing up the backend (api/realtime/worker) and admin portal on a dedicated EC2 instance
so the founder can test the app against a real deployed backend. See `prompt.md` §13 for the full
plan this was built from (decisions locked in, rough shape recommended) — this file tracks what's
actually been done against that plan, created at the start of the first real deployment session per
the same "create the tracker immediately" discipline used for `admin_progress.md`.

**Current status, updated 14 Oct 2026: live, fully testable, on a real domain with real HTTPS.**
API, realtime, admin portal, and the web-hosted mobile app are all up, migrated, and reachable from
the public internet at `https://swishfy.com` / `https://admin.swishfy.com` / `https://api.
swishfy.com` (the raw IP + ports below still work too, the domain just sits in front via nginx —
see the "Domain + TLS" section further down for how). An admin account and a founder account both
exist and log in successfully. Category/taxonomy reference data is seeded. **All local backend
processes on the dev machine are stopped** (Docker Postgres/Redis, local API/realtime/admin-portal
dev servers) — only Expo (the mobile app, pointed at `https://api.swishfy.com`) runs locally,
matching §13's standing rule. **Since this was written, live streaming (Amazon IVS) was also built
and deployed on this same instance** — see `streaming_progress.md` (separate file, same local-only
convention) for that work; this file stays focused on the deployment/infra side.

**Admin login** (`https://admin.swishfy.com`, or `http://51.20.58.18:8080` directly):
`deploy-smoke-test@example.com` / `TestPassword123!` — this was the signup used to smoke-test the
deployment, then promoted to `ADMIN` directly via SQL (`UPDATE "User" SET role = 'ADMIN' WHERE
email = ...`) since the runtime container only has `dist/`, not the raw `scripts/` source
`promote-admin.ts` needs — same effect, confirmed via a real login returning a JWT with
`"role":"ADMIN"`.

**Founder login** (`https://swishfy.com`, or `http://51.20.58.18:8082` directly):
`productionenterprise@gmail.com` / `FounderAccess123!`, a `BUYER` role account, verified via the
token printed to the API container's logs (no real email provider configured yet, same
`ConsoleEmailNotifier` stub as local dev). Expo Go on iOS only supports the latest SDK, and this
project is on SDK 54 — the web version is the reliable path for phone/laptop alike if testing via
Expo Go ever comes up again.

## What's running

- **Instance**: `swish-backend` (`i-05a15e198197f073b`), Ubuntu — AWS defaulted the AMI picker to
  **26.04 LTS** ("resolute"), not the 22.04 originally planned in `prompt.md` §13; noted as a
  deviation, not a problem — still Ubuntu, works fine. Region `eu-north-1` (Stockholm). `t3.medium`,
  30GB gp3.
- **Elastic IP**: `51.20.58.18`, associated — survives stop/start.
- **Security group** (`launch-wizard-5` — the AWS auto-name was kept, not renamed to
  `swish-backend-sg`): SSH (22) restricted to the launching IP; 3000 (api), 3001 (realtime), 8080
  (admin portal), 8082 (web app) open to `0.0.0.0/0`. Postgres/Redis are **not** in the security
  group at all — bound to `127.0.0.1` only in `docker-compose.prod.yml`, reachable only inside the
  instance.
- **Key**: `swish-backend-key.pem`, kept in the repo working directory locally, **gitignored**
  (`*.pem` added to `.gitignore` this session — was previously untracked but not ignored).
- **Repo on the instance**: `~/swish` on the EC2 box, cloned via a read-only GitHub deploy key
  (title `swish-backend-ec2`, added by the founder — the session's own `gh` account had push but
  not admin rights on `Notablex/Mint`, so deploy keys couldn't be added via API). Kept in sync with
  `main` throughout — currently at `513c38f`.
- **Docker**: Engine 29.9.0 + Compose plugin v5.6.0, installed via the official apt repo.
- **Services** (`docker-compose.prod.yml`, committed to the repo): `postgres`, `redis`, `api`,
  `realtime`, `worker`, `admin-portal` (nginx serving the Vite build), `app-web` (nginx serving an
  Expo web export of the mobile app, port 8082 — added after the founder asked for a plain browser
  link, not just phone/Expo-Go access). **`minio` was dropped** — `minio/minio` is no longer
  pullable from Docker Hub (access changed), and nothing in the app calls S3/storage endpoints yet
  anyway (confirmed in `prompt.md` §5a); add it back for real once storage work actually starts.
- **`.env`**: real file on the instance only (gitignored pattern, never committed). Fresh
  `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (never reused from local dev). Stripe stays in **test
  mode** (same test keys as local `.env` — this is a testing-stage deployment, no real money).
  LiveKit still the `replace` placeholder (D-005 unresolved, unrelated to this task).
- **Database**: fresh Postgres, all 21 migrations applied via `prisma migrate deploy` inside the
  `api` container, then seeded (category taxonomy + ledger accounts via `prisma/seed.ts`). Has an
  `ADMIN` account, a `BUYER` founder account, and a `deploy-smoke-test` buyer account from earlier
  verification — all harmless test rows, same pattern as the local dev test accounts.

## Two real bugs found and fixed in the repo's own `Dockerfile` (not EC2-specific — affects anyone building these images)

1. **Missing OpenSSL**: `node:22-slim` has no libssl, which Prisma's engine binaries need to detect
   the right target. Added `apt-get install -y openssl` to the `deps`, `api`, `realtime`, and
   `worker` stages.
2. **Wrong `node_modules` source (the real blocker)**: the three runtime stages copied
   `node_modules` from the `deps` stage, which is _before_ `pnpm prisma generate` runs (that only
   happens in the separate `build` stage). The generated Prisma client was never actually in the
   runtime images — the `api` container crash-looped on every start with `@prisma/client did not
initialize yet`. Fixed by copying `node_modules` `--from=build` instead of `--from=deps` in all
   three runtime stages. **This means `docker compose up` against the old committed `Dockerfile`
   would never have produced a working `api`/`realtime`/`worker` container, on EC2 or anywhere
   else** — worth pushing this fix to `main` regardless of what else happens with this deployment.

**Committed**: the `Dockerfile` fix, `docker-compose.prod.yml`, `admin-portal/Dockerfile`, and
`frontend/Dockerfile` (the web build) are all pushed to `main` and pulled onto the EC2 instance —
the instance's repo stays in sync with what's actually running throughout this session.

**Third bug found and fixed, in `frontend/Dockerfile`**: `npm ci` failed on the instance
(`Invalid: lock file's picomatch@2.3.2 does not satisfy picomatch@4.0.7`) even though
`package-lock.json` installs cleanly locally. Cause: local npm is 11.4.1, the `node:22-slim` base
image ships npm 10.9.9, and the two versions resolve/validate the lockfile differently. Fixed by
adding `RUN npm install -g npm@11` before `npm ci` in the build stage. Verified with a local Docker
build before pushing, to avoid another slow EC2 round-trip.

## Verified live this session

- `GET /health/ready` on both api (3000) and realtime (3001): `200`.
- Admin portal (`8080`): `200`, built with `VITE_API_URL=http://51.20.58.18:3000/v1` and
  `VITE_REALTIME_URL=http://51.20.58.18:3001` baked in at build time (Vite env vars are
  compile-time, not runtime — rebuilding the admin-portal image is required if the IP/domain ever
  changes).
- `POST /v1/auth/register` against the live public IP: `201`, real row written to the live
  Postgres — confirms the full path (public internet → security group → container → Postgres)
  works end to end, not just that containers are "up".
- `POST /v1/auth/login` for the promoted admin account: `200`, JWT payload carries
  `"role":"ADMIN"` — confirms the promotion actually took effect, not just that the SQL ran.
- `prisma/seed.ts` run successfully against the live instance (18 category rows, 4 ledger accounts)
  — a fresh `prisma migrate deploy` only creates schema, not reference data; the Discover screen's
  category pills were empty until this ran. **Needed `docker cp`-ing `src/` and `tsconfig.json`
  from the instance's own git checkout (`~/swish`) into the running `api` container first** — the
  runtime image only has compiled `dist/`, so `ts-node prisma/seed.ts` couldn't resolve its
  `../src/shared/ids/id` import or find a `tsconfig.json` without them. Not something that needs
  doing again unless the container gets recreated — the copied files don't persist a rebuild, but
  the seeded rows are in Postgres, not the container.
- Web app (`8082`): `200`, serves the real exported `index.html` (confirmed by response body, title
  "ShopaFlo"). Built with `EXPO_PUBLIC_API_URL=http://51.20.58.18:3000/v1` baked in at build time —
  same compile-time-env caveat as the admin portal, a rebuild is needed if the IP/domain changes.

## Domain + TLS (added after the founder bought `swishfy.com`)

No longer raw-IP-only — superseded the "no TLS, no domain" item from §13. **Real, trusted HTTPS is
live** on all three public services:

- `https://swishfy.com` (+ `www.`) → the web app (port 8082 internally)
- `https://admin.swishfy.com` → the admin portal (port 8080 internally)
- `https://api.swishfy.com` → the backend API (port 3000), with `/socket.io/` specifically proxied
  to the realtime process (port 3001) with WebSocket upgrade headers, since Socket.IO needs that
  one path routed differently from everything else

**How it's wired**: DNS is 4 records at the registrar (`A @`, `A admin`, `A api` → `51.20.58.18`,
plus a pre-existing `CNAME www` → the root) — all added by the founder himself, no registrar access
shared with us. On the instance: **nginx installed directly on the host** (not a container) as a
reverse proxy in front of the Docker services, config at
`/etc/nginx/sites-available/swishfy.conf`. **Certbot** (`python3-certbot-nginx`) obtained a real
Let's Encrypt certificate covering all four hostnames in one request, auto-configured nginx for
HTTPS, and set up automatic renewal (expires 2027-01-11, renews itself before then). Plain HTTP
now 301-redirects to HTTPS on all three.

**The web app and admin portal were rebuilt** with their API/realtime URLs pointed at
`https://api.swishfy.com` instead of the raw IP — required, not cosmetic: once the pages themselves
serve over HTTPS, a browser blocks any plain-HTTP API calls from them as mixed content. Also added
an explicit `EXPO_PUBLIC_REALTIME_URL` build arg to `frontend/Dockerfile` (previously the app
auto-derived the realtime URL as `<api-host>:3001`, which would have pointed at a port with no TLS
listener at all now that nginx only terminates TLS on 443 — the realtime path has to go through
nginx's `/socket.io/` proxy on the same HTTPS origin instead).

**Ports 80 and 443 opened** in the security group (`launch-wizard-5`) for this. The original
IP-based URLs (`:3000`, `:8080`, `:8082`) still work directly and are unaffected, nginx just adds
the domain-based HTTPS path in front of them.

## Not done yet / open items

- **D-002 (whose AWS account)** — still open per `09-DECISIONS.md`; this instance was created in
  the account the founder/user already had access to, worth a founder confirmation this is the
  intended long-term account.
- **No CI/CD, manual deploy only** — matches the plan (§13 explicitly deferred this). A future
  change means: SSH in, `git pull` in `~/swish`, `docker compose -f docker-compose.prod.yml build`,
  `up -d`, and `prisma migrate deploy` again if the schema changed.
