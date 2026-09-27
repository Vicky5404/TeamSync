# FlowSync — API

Backend for **FlowSync**: REST API, real-time WebSocket gateway and background workers for
organizations, projects, Kanban tasks, comments, files, notifications and analytics. It implements
the contract the web client already uses (see [`frontend/README.md`](../frontend/README.md#rest-api-contract)).

- **Stack:** Node.js 22 · NestJS 12 (ESM) · TypeScript 6 · Prisma 7 + PostgreSQL · Redis ·
  BullMQ 6 · WebSockets (`ws`) · Passport JWT · class-validator · Swagger/OpenAPI · pino · S3 API
- **Processes:** `api` (HTTP + WebSocket) and `worker` (queues and scheduled jobs). Both are
  stateless and scale horizontally; they coordinate through PostgreSQL and Redis.

---

## Getting started

**Prerequisites:** Node.js **≥ 22.12** (22.22+ recommended), npm 10+, and PostgreSQL 14+, Redis 6.2+
(or Valkey) and an S3-compatible object store. The root [`docker-compose.yml`](../docker-compose.yml)
provides all of them (and can also run the whole application — see the root README).

```bash
docker compose up -d postgres redis s3 mailpit   # from the repository root
cd backend
cp .env.example .env          # defaults match docker-compose.yml
npm install                   # also generates the Prisma client
npm run prisma:deploy         # apply migrations
npm run db:seed               # optional demo data (demo@flowsync.dev / Password123!)
npm run start:dev             # API on http://localhost:4000, workers in-process (RUN_WORKERS_IN_API)
```

- API: `http://localhost:4000/api/v1` · WebSocket: `ws://localhost:4000/ws` · Health: `/health`
- API docs (Swagger UI): `http://localhost:4000/api/v1/docs` (OpenAPI JSON at `/api/v1/docs-json`)
- Emails (verification, password reset, invitations, notifications): Mailpit at `http://localhost:8025`

### Using it from the web client

Run `npm run dev` in `frontend/` — its `.env.development` already targets this API
(`DEV_API_PROXY_TARGET=http://localhost:4000`, `VITE_WS_URL=/ws`). The Vite dev server proxies `/api`
and `/ws` to the API, so cookies, CORS and WebSocket origins all stay same-origin
(`CORS_ORIGINS=http://localhost:5173`). Sign in with the seeded `demo@flowsync.dev / Password123!`.
Links in emails point at `APP_URL` (`/verify-email`, `/reset-password`, `/accept-invitation`).

### Scripts

| Command                           | Description                                                      |
| --------------------------------- | ---------------------------------------------------------------- |
| `npm run start:dev`               | API with watch mode (`tsc --watch` + `node --watch`)             |
| `npm run start:worker:dev`        | Worker process with watch mode                                   |
| `npm run build`                   | Generate the Prisma client and compile to `dist/`                |
| `npm run start:prod`              | Run the compiled API (`dist/main.js`)                            |
| `npm run start:worker:prod`       | Run the compiled worker (`dist/worker.js`)                       |
| `npm run typecheck`               | Type-check everything (sources, tests, seed, config)             |
| `npm run lint` / `lint:fix`       | ESLint (type-aware), 0 warnings                                  |
| `npm run format` / `format:check` | Prettier                                                         |
| `npm test` / `test:cov`           | Unit tests (Vitest) / with coverage                              |
| `npm run test:integration`        | Integration tests against PostgreSQL, Redis and S3 (see Testing) |
| `npm run prisma:migrate`          | Create + apply a migration in development (`prisma migrate dev`) |
| `npm run prisma:deploy`           | Apply pending migrations (CI/CD, production)                     |
| `npm run prisma:studio`           | Browse the database                                              |
| `npm run db:seed`                 | Seed demo data (idempotent; refuses to run in production)        |

> The Nest CLI is intentionally not used: `tsc` builds the project directly (the CLI's generators
> need Node ≥ 22.22). esbuild-based runners are avoided because Nest's dependency injection needs
> `emitDecoratorMetadata`.

---

## Environment variables

All variables are validated at startup ([`src/config/env.validation.ts`](src/config/env.validation.ts)).
Invalid configuration — or unsafe production configuration (insecure cookies, example JWT secret,
log-only email) — aborts the process with a descriptive error. See [`.env.example`](.env.example).

| Variable                                                                  | Default                                | Description                                                                                                      |
| ------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                | `development`                          | `development` \| `test` \| `production`                                                                          |
| `PORT`                                                                    | `4000`                                 | HTTP/WebSocket port                                                                                              |
| `API_PREFIX`                                                              | `api/v1`                               | Route prefix (`/health` is always unprefixed)                                                                    |
| `APP_URL`                                                                 | `http://localhost:5173`                | Web client origin, used for links in emails                                                                      |
| `PUBLIC_API_URL`                                                          | `/api/v1`                              | How browsers reach the API (avatar URLs)                                                                         |
| `CORS_ORIGINS`                                                            | `http://localhost:5173`                | Comma-separated allowed origins (CORS, WebSocket and CSRF origin checks)                                         |
| `TRUST_PROXY`                                                             | `false`                                | Express `trust proxy` (`true`, hop count, or subnets) — set behind a load balancer so rate limits see client IPs |
| `LOG_LEVEL` / `LOG_PRETTY`                                                | `info` / `false`                       | pino level; pretty output needs the dev dependency `pino-pretty`                                                 |
| `SWAGGER_ENABLED` / `SWAGGER_PATH`                                        | on outside production / `docs`         | Swagger UI at `/<prefix>/<path>`; off in production unless set to `true`                                         |
| `RUN_WORKERS_IN_API`                                                      | `false`                                | Run queue processors inside the API process (handy locally)                                                      |
| `WORKER_HEALTH_PORT`                                                      | `4001`                                 | Worker process health endpoint (`/health`, `/health/live`); `0` disables it                                      |
| `APP_VERSION`                                                             | `dev`                                  | Build identifier added to every log line (set by the Docker build arg)                                           |
| `DATABASE_URL`                                                            | —                                      | PostgreSQL connection string (**required**)                                                                      |
| `DATABASE_POOL_SIZE`                                                      | `10`                                   | Connections per process                                                                                          |
| `SHADOW_DATABASE_URL`                                                     | —                                      | Optional shadow DB for `prisma migrate dev`                                                                      |
| `REDIS_URL` / `REDIS_KEY_PREFIX`                                          | `redis://localhost:6379` / `flowsync:` | Redis connection and key namespace                                                                               |
| `JWT_ACCESS_SECRET`                                                       | —                                      | ≥ 32 random chars (**required**), e.g. `openssl rand -base64 48`                                                 |
| `JWT_ACCESS_TTL`                                                          | `900`                                  | Access-token lifetime (seconds)                                                                                  |
| `JWT_ISSUER` / `JWT_AUDIENCE`                                             | `flowsync-api` / `flowsync-web`        | Token `iss` / `aud` claims (verified)                                                                            |
| `REFRESH_TOKEN_TTL_DAYS`                                                  | `30`                                   | Refresh lifetime with "keep me signed in" (sliding)                                                              |
| `REFRESH_TOKEN_SHORT_TTL_HOURS`                                           | `24`                                   | Refresh lifetime otherwise (browser-session cookie)                                                              |
| `REFRESH_COOKIE_NAME`                                                     | `flowsync_rt`                          | httpOnly cookie scoped to `/<prefix>/auth`                                                                       |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` / `COOKIE_DOMAIN`                     | `false` / `lax` / —                    | Cookie attributes (`COOKIE_SECURE=true` required in production)                                                  |
| `AUTH_REQUIRE_EMAIL_VERIFICATION`                                         | `true`                                 | Block sign-in until the email is verified                                                                        |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCKOUT_MINUTES`                            | `5` / `15`                             | Per-account lockout after failed sign-ins                                                                        |
| `THROTTLE_TTL_SECONDS` / `THROTTLE_LIMIT`                                 | `60` / `300`                           | Global rate limit per user (or IP when anonymous)                                                                |
| `S3_BUCKET` / `S3_REGION`                                                 | `flowsync` / `us-east-1`               | Object storage bucket                                                                                            |
| `S3_ENDPOINT`                                                             | —                                      | Custom endpoint for S3-compatible stores (empty for AWS)                                                         |
| `S3_PUBLIC_ENDPOINT`                                                      | —                                      | Endpoint used in presigned URLs when browsers see storage at a different host                                    |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`                               | —                                      | Credentials (omit on AWS to use the default provider chain / IAM role)                                           |
| `S3_FORCE_PATH_STYLE`                                                     | `false`                                | `true` for most S3-compatible stores                                                                             |
| `UPLOAD_MAX_FILE_SIZE_MB` / `AVATAR_MAX_FILE_SIZE_MB`                     | `25` / `5`                             | Upload limits                                                                                                    |
| `SIGNED_URL_TTL_SECONDS`                                                  | `900`                                  | Presigned URL lifetime                                                                                           |
| `MAIL_TRANSPORT`                                                          | `log`                                  | `smtp` sends; `log` prints messages (development only)                                                           |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` | `localhost` / `1025` / `false`         | SMTP settings                                                                                                    |
| `MAIL_FROM`                                                               | `FlowSync <no-reply@flowsync.dev>`     | Sender                                                                                                           |

---

## Database (PostgreSQL + Prisma)

Full reference — ER diagram, constraints, tenant isolation, soft deletes, indexing, transactions
and migration workflow: **[`docs/database.md`](../docs/database.md)**.

- Schema: [`prisma/schema.prisma`](prisma/schema.prisma); config: [`prisma.config.ts`](prisma.config.ts)
  (Prisma 7 reads `DATABASE_URL` from there and loads `.env` itself).
- Tables and columns are snake_case; primary keys are time-ordered UUIDv7. `organization_id` is
  denormalized onto tenant-owned tables, and composite `(…, organization_id)` foreign keys make
  cross-organization references impossible at the database level. Search uses `pg_trgm` GIN
  indexes (the extension is created by the first migration).
- Projects, tasks and comments are soft-deleted into a 30-day trash (`POST /projects/:id/restore`,
  `POST /tasks/:id/restore`), then purged with their files by the `purge-trash` job. Deleted user
  accounts (`DELETE /users/me`) are anonymized rather than removed, so authorship survives.
- Security and administration events are recorded in an immutable audit log
  (`GET /organizations/:id/audit-logs`, owners and admins).
- The database must use **UTF8** encoding (the API warns at startup otherwise).
- File contents never go into PostgreSQL — only object-storage metadata.

```bash
npm run prisma:migrate -- --name add_something   # change the schema, then create + apply a migration (dev)
npm run prisma:deploy                            # apply migrations in CI/CD before rolling out
npm run prisma:generate                          # regenerate the client (also runs on npm install)
```

In containers, run the `migrate` image (`docker build --target migrate`) as a one-off job before
starting new API/worker versions — see [`docs/deployment.md`](../docs/deployment.md#release-procedure).

## Redis

One Redis (≥ 6.2, or Valkey) is used for:

| Use               | Keys / mechanism                                                                        |
| ----------------- | --------------------------------------------------------------------------------------- |
| Queues            | BullMQ (`bull:*`) — notifications, email, reports, maintenance                          |
| Real-time fan-out | Pub/sub channel `<prefix>realtime:events` between API instances and workers             |
| Rate limiting     | Atomic Lua fixed-window counters (`throttle:*`), shared by all instances                |
| Caching           | Memberships (60 s), resource→organization scopes (10 min), analytics (5 min, versioned) |
| Short-lived data  | Login-failure counters, revoked-session denylist, due-date reminder markers             |

Cache entries are only for data every reader of the key may see (keys encode the organization);
secrets, tokens and password hashes are never cached. Membership entries are invalidated on every
role change/removal; analytics use a per-organization version counter bumped on every task,
project or member write. If Redis is unavailable, caching, rate limiting and revocation checks
fail open with warnings while the database stays the source of truth.

Use `maxmemory-policy noeviction` — BullMQ requires it.

## Background workers

Queues are defined in [`src/infrastructure/queue`](src/infrastructure/queue); processors live in
[`src/modules/jobs`](src/modules/jobs).

| Queue           | Jobs                                                                                                                                                                               | Retries                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `notifications` | deliver notifications (preferences → DB → WebSocket → email queue); hourly due-date scan                                                                                           | 5, exponential from 2 s  |
| `email`         | send transactional/notification email                                                                                                                                              | 6, exponential from 10 s |
| `reports`       | generate CSV reports to object storage (marks the report `FAILED` after the last attempt)                                                                                          | 3, exponential from 15 s |
| `maintenance`   | expired sessions/tokens/invitations, old notifications, reports and audit entries, abandoned uploads, trash older than 30 days (daily/hourly); deleting stored files after deletes | 3, exponential from 60 s |

Every job logs completion and failures (final failures as errors; failed jobs are kept 7 days for
inspection). Scheduled jobs are registered idempotently by every worker on startup.

```bash
npm run start:worker:prod     # production: run 1+ worker processes alongside the API (RUN_WORKERS_IN_API=false)
```

For local development `RUN_WORKERS_IN_API=true` runs the processors inside the API process.

## API documentation

Swagger UI is served at **`/api/v1/docs`** (OpenAPI JSON at `/api/v1/docs-json`) and documents
authentication, organizations, members & invitations, projects, tasks, comments, labels,
notifications, files, activity, audit log, analytics, search and health — including request/response
schemas, enums and error responses.

**Conventions**

- Errors: `{ code, message, fieldErrors?, requestId }` with proper status codes; validation errors
  are `422 VALIDATION_ERROR` with per-field messages. Every response carries `X-Request-Id`.
- Lists: `{ data, meta: { page, pageSize, total, totalPages } }`; feeds (activity, notifications):
  `{ data, nextCursor }`. Array query params repeat the key (`status=TODO&status=DONE`).
- Dates: `YYYY-MM-DD` for due/start dates (UTC calendar dates); ISO-8601 timestamps otherwise.

**Real-time** — connect to `/ws`, then send JSON messages:

```jsonc
{ "type": "auth", "token": "<access token>" }                  // → { "type": "ready" }
{ "type": "subscribe", "channel": "organization:<id>" }        // or "project:<id>"
{ "type": "ping" }                                             // → { "type": "pong" }
```

Server events: `task.created`, `task.updated`, `task.moved`, `task.deleted`, `comment.created`,
`notification.created` (private `user:<id>` channel, joined automatically), `member.updated`,
`project.updated`, `report.ready`. Each socket receives an event once even if it is subscribed to
both the project and organization rooms. A removed member's organization subscriptions are revoked,
so their `member.updated` (`action: "removed"`) is also sent on their private channel. Invalid or
expired tokens close the socket with code `4401` (the web client refreshes and reconnects). Before a
token expires the server sends `{ "type": "reauth" }` and the client re-authenticates in place;
revoking a session (logout, password change…) closes its sockets immediately. Protocol details:
[`docs/realtime.md`](../docs/realtime.md).

---

## Architecture

```
src/
  main.ts / worker.ts   Entry points (API: HTTP + WebSocket; worker: queues + schedulers)
  bootstrap/            HTTP pipeline (helmet, CORS, cookies, body limits, validation, errors, Swagger)
  config/               Environment validation and typed AppConfig
  common/               Auth decorators, RBAC (permissions, AccessGuard, AccessResolver),
                        error model + global filter, validation pipe, pagination, utilities
  infrastructure/       Prisma, Redis (cache, rate-limit storage), BullMQ producers, S3 storage,
                        mail, logging
  modules/              auth · users · organizations · projects · tasks · comments · labels ·
                        notifications · files · activity · analytics · search · realtime · health · jobs
prisma/                 Schema, migrations, seed
```

- **Controllers are thin**: they validate input (DTOs), resolve access and delegate to services;
  services hold business logic; repositories hold non-trivial queries.
- **Authorization is secure by default.** A global `AccessGuard` resolves any route param naming an
  organization-owned resource (`organizationId`, `projectId`, `taskId`, `commentId`,
  `attachmentId`) to its organization and requires membership (non-members get **404**, so
  existence isn't leaked). `@RequirePermission()` adds the role check (**403**). Services receive
  the resolved `AccessContext` and still scope every query by organization.
- **Writes** run in a transaction together with their activity-log entries; after commit, services
  enqueue notifications, invalidate caches and publish real-time events (best-effort — a Redis
  hiccup never fails a committed change).

### Security

- Passwords: Argon2id (OWASP parameters), transparent rehash on sign-in, constant-time behaviour
  for unknown accounts, per-account lockout plus per-IP/per-user rate limits.
- Tokens: 15-minute HS256 access tokens (issuer/audience/algorithm pinned); opaque 256-bit refresh
  tokens stored as SHA-256 hashes, rotated on every use with reuse detection, in an httpOnly,
  SameSite cookie scoped to the auth routes. Logout, password changes and session revocation
  take effect immediately (Redis denylist). Cookie-authenticated endpoints check `Origin`.
- Input: global validation with whitelisting (unknown fields rejected), body size limits, UUID
  param validation, strict enums/dates.
- Files: extension allow-list **and** content sniffing (no HTML/SVG/executables), size limits,
  private bucket, short-lived presigned URLs that force `Content-Disposition: attachment`.
  CSV reports neutralize spreadsheet formula injection.
- Headers: helmet (CSP, HSTS in production, no-sniff, frame protection), strict CORS allow-list,
  WebSocket origin check, per-connection message rate limits and payload caps.
- Logs: structured JSON tagged with service/env/version; request logs carry the request id, user,
  organization, status and `durationMs`. Authorization headers, cookies, passwords, tokens, emails
  and sensitive query values are redacted. 5xx responses never include internal details.

## Testing

```bash
npm test                   # unit tests (~10 s, no services needed)
npm run test:integration   # integration tests: real app + PostgreSQL + Redis + S3
```

**Unit tests** (`src/**/*.spec.ts`, Vitest) cover authentication (sign-in, lockout, token
issuing/verification/revocation, refresh rotation and reuse detection, account deletion),
authorization (RBAC table, `AccessGuard`, tenant resolution in `AccessResolver`), task creation and
movement (numbering, positions, completion, rebalancing, notifications, realtime events),
notification creation and delivery preferences, the WebSocket gateway (origin check, channel
authorization, session revocation, token expiry and `reauth`), configuration validation, error
mapping, file-type sniffing, log redaction and utilities.

**Integration tests** (`test/integration/*.e2e-spec.ts`) boot the full application — every guard,
pipe, filter, queue worker and the WebSocket gateway — on an ephemeral port and drive it over
HTTP/WebSocket like the web client does:

| Suite       | Covers                                                                                                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`      | Registration → verification gate → sign-in; cookie attributes; forged tokens; refresh rotation + theft detection; logout revocation; CSRF origin check; lockout; per-IP rate limit; strict validation; password change signs out other sessions                                 |
| `tasks`     | Role enforcement (viewer/member/manager/owner), task numbering, validation, board moves + completion, column rebalancing, notifications via the worker (assignment, status change, mentions; never to the actor)                                                                |
| `isolation` | Another tenant's organization/projects/tasks/comments/attachments are 404 for reads and writes; foreign labels/assignees rejected; scoped lists and search; upload content sniffing and size limits; WebSocket origin check, channel authorization and socket closure on logout |
| `api-docs`  | The OpenAPI document is complete: every operation summarized, tagged, with a success response and the right auth declaration                                                                                                                                                    |

Each run creates a throwaway database (migrated with `migrate deploy`) and bucket, uses Redis
logical database 9 with per-file key prefixes, and removes everything afterwards. Defaults match
the root `docker-compose.yml` (`docker compose up -d postgres redis s3`); override with
`INTEGRATION_DATABASE_URL` (an admin connection, e.g. `…/postgres`), `INTEGRATION_REDIS_URL`,
`INTEGRATION_S3_ENDPOINT`, `INTEGRATION_S3_ACCESS_KEY_ID` and `INTEGRATION_S3_SECRET_ACCESS_KEY`.

## Production checklist

- `NODE_ENV=production`, `COOKIE_SECURE=true`, a strong unique `JWT_ACCESS_SECRET`, `MAIL_TRANSPORT=smtp`.
- Run `prisma migrate deploy` before each release; run API and worker as separate deployments
  (`RUN_WORKERS_IN_API=false`); set `TRUST_PROXY` to match your load balancer.
- Private S3 bucket with encryption at rest and a CORS rule allowing `PUT` from your web origin
  (only needed for direct uploads). Use IAM roles instead of static keys where possible.
- Redis with persistence (AOF) and `noeviction`; PostgreSQL with backups and `UTF8` encoding.
- Probes: liveness `GET /health/live`, readiness `GET /health` (API on 4000, worker on 4001).
- Images: `docker build --target api|worker|migrate .` — full procedure in
  [`docs/deployment.md`](../docs/deployment.md); security model in [`docs/security.md`](../docs/security.md).
