# FlowSync database

PostgreSQL (14+, UTF8) accessed through Prisma 7 with the `pg` driver adapter. The schema lives in
[`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma), migrations in
[`backend/prisma/migrations`](../backend/prisma/migrations) and development data in
[`backend/prisma/seed.ts`](../backend/prisma/seed.ts).

**Contents:** [Quick start](#quick-start) · [ER diagram](#er-diagram) · [Entities](#entities) ·
[Relationships](#relationships) · [Constraints](#constraints) · [Multi-tenancy](#multi-tenancy) ·
[Soft delete](#soft-delete) · [Indexing](#indexing) · [Transactions](#transactions) ·
[Performance](#performance) · [Migrations](#migrations) · [Seed data](#seed-data)

---

## Quick start

From a clean checkout, with Docker running. With the full container stack
(`docker compose up -d --build` in the repository root) migrations run automatically in the
one-off `migrate` service before the API and worker start. To work on the API from source:

```bash
docker compose up -d postgres redis s3 mailpit   # 1. infrastructure (repository root)
cd backend
cp .env.example .env         #    configure environment (defaults match docker-compose.yml)
npm install                  # 2. install dependencies (also runs `prisma generate`)
npm run prisma:deploy        # 3. apply every migration
npm run prisma:generate      # 4. (re)generate the Prisma client — already done by npm install
npm run db:seed              # 5. optional demo data
npm run start:dev            # 6. API on http://localhost:4000
```

Nothing has to be created or edited by hand: the first migration creates the `pg_trgm`
extension, and every constraint, index and trigger comes from the migration files.

> If `.env` points `DATABASE_URL` at the Docker service name (`postgres:5432`), commands run from
> the host need `localhost:5432` instead, e.g.
> `DATABASE_URL=postgresql://flowsync:flowsync@localhost:5432/flowsync npm run prisma:deploy`.
> Variables set in the shell always win over `.env`.

---

## Conventions

- **Primary keys** are UUIDv7 (`@default(uuid(7))`): time-ordered, so inserts stay at the right
  edge of the B-tree, and safe to expose in URLs. Join tables use composite primary keys.
- **Naming:** snake_case tables and columns in SQL, camelCase in the Prisma client.
- **Time:** instants are `TIMESTAMPTZ(3)`; calendar dates (start/due dates) are `DATE`.
- **Strings** have explicit `VARCHAR(n)` limits matching the API validation; free text (task
  descriptions, comment bodies) is `TEXT`.
- **Files** never go into PostgreSQL. Attachments, avatars and reports store object-storage keys.
- **Enums** (roles, statuses, priorities, label colours, notification types) are PostgreSQL enums.
- Rules Prisma cannot express (CHECK constraints, the audit-log trigger) live in migration SQL.
  Prisma doesn't introspect them and never generates statements that drop them.

---

## ER diagram

Identity, organizations and administration:

```mermaid
erDiagram
    users ||--o{ sessions : "signs in on"
    users ||--o{ user_tokens : "verifies / resets with"
    users ||--o{ memberships : "belongs via"
    organizations ||--o{ memberships : "has"
    organizations ||--o{ invitations : "sends"
    users |o--o{ invitations : "invited by"
    organizations ||--o{ labels : "defines"
    organizations ||--o{ projects : "owns"
    organizations |o--o{ audit_logs : "audited in"
    users |o--o{ audit_logs : "acts in"
    organizations |o--o{ notifications : "context of"
    users ||--o{ notifications : "receives"
    organizations ||--o{ reports : "exports"

    users {
        uuid id PK
        varchar email UK "lower-case; tombstoned on deletion"
        varchar name
        text password_hash "Argon2id"
        timestamptz email_verified_at
        timestamptz deleted_at "soft delete"
    }
    organizations {
        uuid id PK
        varchar slug UK
        varchar name
    }
    memberships {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        enum role "OWNER…VIEWER"
    }
    invitations {
        uuid id PK
        uuid organization_id FK
        varchar email "unique per organization"
        text token_hash UK
        timestamptz expires_at
    }
    sessions {
        uuid id PK
        uuid user_id FK
        text refresh_token_hash UK
        timestamptz expires_at
        timestamptz revoked_at
    }
    audit_logs {
        uuid id PK
        uuid organization_id FK "null = account/platform event"
        uuid actor_id FK
        varchar action
        varchar entity_type
        uuid entity_id
        jsonb metadata
    }
```

Projects and work items. The composite `(…, organization_id)` foreign keys are the tenant guard
described under [Multi-tenancy](#multi-tenancy):

```mermaid
erDiagram
    organizations ||--o{ projects : "owns"
    projects ||--o{ project_members : "(project_id, organization_id)"
    memberships ||--o{ project_members : "(organization_id, user_id)"
    projects ||--o{ tasks : "(project_id, organization_id)"
    memberships |o--o{ tasks : "assignee (organization_id, assignee_id)"
    users |o--o{ tasks : "reporter"
    tasks ||--o{ task_labels : "(task_id, organization_id)"
    labels ||--o{ task_labels : "(label_id, organization_id)"
    tasks ||--o{ checklist_items : "has"
    tasks ||--o{ comments : "has"
    comments ||--o{ comment_mentions : "mentions"
    users ||--o{ comment_mentions : "mentioned"
    tasks ||--o{ attachments : "(task_id, organization_id)"
    projects |o--o{ activities : "(project_id, organization_id)"
    tasks |o--o{ activities : "about"

    projects {
        uuid id PK
        uuid organization_id FK
        varchar key "unique among live projects"
        varchar name
        enum status
        int task_sequence "last issued task number"
        timestamptz deleted_at "trash"
    }
    tasks {
        uuid id PK
        uuid organization_id FK
        uuid project_id FK
        int number "unique per project"
        varchar title
        enum status
        enum priority
        float8 position "fractional Kanban order"
        uuid assignee_id FK
        date due_date
        timestamptz completed_at "set iff DONE"
        timestamptz deleted_at "trash"
    }
    comments {
        uuid id PK
        uuid task_id FK
        uuid author_id FK
        text body
        timestamptz deleted_at "soft delete"
    }
    attachments {
        uuid id PK
        uuid organization_id FK
        uuid task_id FK
        varchar storage_key UK
        enum status "PENDING / READY"
    }
    activities {
        uuid id PK
        uuid organization_id FK
        uuid project_id FK
        uuid task_id FK
        varchar action
        jsonb target "snapshot"
    }
```

---

## Entities

Some requested entity names map onto existing models. Renaming them would have touched most of
the codebase and bought nothing:

| Concept              | Model (table)                    | Notes                                                                           |
| -------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| User                 | `User` (`users`)                 | Global identity; not owned by a tenant                                          |
| Account / session    | `Session` (`sessions`)           | One row per signed-in device. No OAuth yet, so no separate `Account` table      |
| Refresh token        | `Session.refreshTokenHash`       | Opaque token, stored as SHA-256 only, rotated on every use with reuse detection |
| Email / reset tokens | `UserToken` (`user_tokens`)      | Single use, hashed, expiring                                                    |
| Organization         | `Organization` (`organizations`) | The tenant                                                                      |
| OrganizationMember   | `Membership` (`memberships`)     | Role per user per organization                                                  |
| Invitation           | `Invitation` (`invitations`)     | Pending invitation; deleted on accept/revoke/expiry                             |
| Project              | `Project` (`projects`)           | Has a short key (`WEB`) used in task identifiers (`WEB-42`)                     |
| ProjectMember        | `ProjectMember`                  | Which organization members work on a project                                    |
| Task                 | `Task` (`tasks`)                 | Kanban card; `number` is sequential per project                                 |
| Label / TaskLabel    | `Label`, `TaskLabel`             | Organization-wide labels; many-to-many with tasks                               |
| ChecklistItem        | `ChecklistItem`                  | Ordered sub-items of a task                                                     |
| Comment              | `Comment` (+ `CommentMention`)   | Task discussion; mentions drive notifications                                   |
| Attachment           | `Attachment`                     | Object-storage metadata; `PENDING` until a direct upload is verified            |
| Notification         | `Notification`                   | Per-user inbox entry                                                            |
| ActivityLog          | `Activity` (`activities`)        | Collaboration feed shown in the product                                         |
| AuditLog             | `AuditLog` (`audit_logs`)        | Immutable security/admin trail, readable by owners and admins                   |
| (report exports)     | `Report` (`reports`)             | Background CSV exports                                                          |

**Activity vs. audit log.** Both are append-only, but they serve different readers. Activity is
the product feed ("Sofia moved WEB-2 to Review"): every member sees it, and it describes work.
The audit log answers "who changed what, from where": role changes, removals, invitations,
deletions and restores, ownership transfers, password changes, account deletion. Each entry
records IP address, user agent and request id. Only OWNER/ADMIN can read it
(`GET /organizations/:id/audit-logs`, permission `audit:read`), and a trigger rejects every
`UPDATE`.

---

## Relationships

`→` means "references"; the action in brackets is what happens when the referenced row is
deleted.

- **Organization → everything it owns** (cascade). Deleting an organization erases the tenant:
  memberships, invitations, labels, projects, tasks, attachments, activity, notifications about it,
  reports and its audit log. The deletion itself is written as a platform-level audit entry
  (`organization_id` NULL), so it outlives the tenant.
- **Membership → organization, user** (cascade), unique on `(organization_id, user_id)`: a user
  can't join an organization twice.
- **ProjectMember → project** via `(project_id, organization_id)` and **→ membership** via
  `(organization_id, user_id)` (both cascade). A project member must be a member of the same
  organization, and loses their project memberships when they leave it.
- **Task → project** via `(project_id, organization_id)` (cascade). A task can't sit in another
  organization's project.
- **Task → assignee membership** via `(organization_id, assignee_id)` (no action). Only members
  can be assigned, and a membership can't be deleted while tasks still point at it. The
  application unassigns first (`OrganizationsRepository.detachMember`).
- **Task → reporter** (set null). Authorship survives the reporter leaving.
- **TaskLabel → task** via `(task_id, organization_id)` and **→ label** via
  `(label_id, organization_id)` (cascade): labels never cross organizations.
- **Attachment → task** via `(task_id, organization_id)` (cascade).
- **Activity → project** via `(project_id, organization_id)` (cascade); **→ task** (set null), so
  a task's history survives its purge.
- **ChecklistItem, Comment → task** (cascade); **Comment → author** (set null);
  **CommentMention → comment** (cascade).
- **Notification → recipient** (cascade), **→ actor** (set null), **→ organization** (cascade,
  optional).
- **AuditLog → organization** (cascade, optional), **→ actor** (set null; the only update the
  immutability trigger allows).
- **Session, UserToken → user** (cascade).

Users are soft-deleted (see below), so the `SET NULL` user references only fire if a user row is
ever hard-deleted by an operator.

---

## Constraints

Beyond primary keys, NOT NULL columns and defaults:

| Kind             | Constraint                                                           | Enforces                                                              |
| ---------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Unique           | `users(email)`, `organizations(slug)`, token hashes, `storage_key`   | Identity and single-use tokens                                        |
| Unique           | `memberships(organization_id, user_id)`                              | No duplicate organization memberships                                 |
| Unique           | `invitations(organization_id, email)`                                | One pending invitation per address per organization                   |
| Unique           | `labels(organization_id, name)`                                      | Label names per organization                                          |
| Unique (partial) | `projects(organization_id, key) WHERE deleted_at IS NULL`            | Project keys among live projects; a trashed project releases its key  |
| Unique           | `tasks(project_id, number)`                                          | Task identifiers; numbers are never reused                            |
| Composite PK     | `project_members`, `task_labels`, `comment_mentions`                 | No duplicate links                                                    |
| Composite FK     | see [Relationships](#relationships)                                  | No cross-tenant references; assignees and project members are members |
| CHECK            | `users.email = lower(email)`, same for `invitations`                 | Case-insensitive uniqueness without `citext`                          |
| CHECK            | `organizations.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`                    | URL-safe slugs                                                        |
| CHECK            | `projects.key ~ '^[A-Z][A-Z0-9]{1,5}$'`, `task_sequence >= 0`        | Valid task identifiers                                                |
| CHECK            | `projects.due_date >= start_date`                                    | Date order                                                            |
| CHECK            | `tasks.number > 0`, `(status = 'DONE') = (completed_at IS NOT NULL)` | Completion metrics rely on `completed_at`                             |
| CHECK            | `tasks.position` / `checklist_items.position` finite                 | NaN or ±Infinity would break fractional ordering                      |
| CHECK            | `attachments.size >= 0`                                              |                                                                       |
| Trigger          | `audit_logs_append_only` (BEFORE UPDATE)                             | Audit entries are immutable                                           |

The API validates the same rules and returns friendly `422`/`409` errors. The database
constraints are the backstop against bugs, races and manual SQL. Constraint violations that reach
the exception filter map to `409 CONFLICT` (unique/foreign key) or `500` (check).

---

## Multi-tenancy

The organization is the tenant. Isolation is enforced in three layers.

**1. Request authorization (application).** A global `AccessGuard` resolves every route param that
names an organization-owned resource (`organizationId`, `projectId`, `taskId`, `commentId`,
`attachmentId`) to its organization and requires a membership. Non-members get **404**, so other
tenants' ids aren't even confirmed to exist. `@RequirePermission()` adds the role check (403).
This is secure by default: a new route under `/tasks/:taskId/…` is protected without any extra
code.

**2. Query scoping (application).** Services receive the resolved `AccessContext` and scope every
query with its `organizationId`, never with an id taken from the request body. Caches are keyed
by organization.

**3. Referential integrity (database).** Every organization-owned row is traceable to exactly one
organization, and composite foreign keys make it impossible to link rows across organizations,
even through a bug or manual SQL:

| Table                                                                  | Organization via                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| `memberships`, `invitations`, `labels`, `projects`, `reports`          | `organization_id` (FK)                                          |
| `tasks`, `attachments`, `activities`, `project_members`, `task_labels` | `organization_id`, checked against the parent by a composite FK |
| `comments`, `checklist_items`                                          | `task_id` → `tasks.organization_id`                             |
| `comment_mentions`                                                     | `comment_id` → comment → task                                   |
| `notifications`                                                        | `organization_id` (optional: inbox entries belong to the user)  |
| `audit_logs`                                                           | `organization_id` (NULL for account-level and platform events)  |
| `users`, `sessions`, `user_tokens`                                     | Not tenant-owned (global identity)                              |

`organization_id` is denormalized onto the hot tables so tenant-scoped lists and analytics never
need a join. The composite keys are what make that denormalization safe: a task's
`organization_id` can't disagree with its project's.

### Row Level Security: considered, not enabled

PostgreSQL RLS would add a fourth layer, but it doesn't fit this architecture cleanly today:

- With a connection pool, the tenant has to be set per transaction (`SET LOCAL app.org_id`).
  Every query would need to run inside an interactive transaction: an extra round trip each time,
  and pool connections held longer.
- Several legitimate paths are cross-tenant by design: "my organizations", the notification inbox,
  the hourly due-date scan, the retention/purge jobs and search across a user's memberships. They
  would need a second role with `BYPASSRLS` and a second pool, which weakens the benefit.
- Policies on `comments` and `checklist_items` would have to join `tasks` on every row.

The schema is ready for it if requirements change (for example, direct SQL access by other
services): every tenant table has, or is one hop from, an `organization_id`. The path would be a
`flowsync_app` role without `BYPASSRLS`, a Prisma client extension that wraps each operation in
`$transaction([set_config('app.org_id', …, true), query])`, policies of the form
`USING (organization_id = current_setting('app.org_id')::uuid)`, and a separate privileged
connection for workers.

---

## Soft delete

Applied only where recovery or history justifies the cost. Every read of a soft-deletable table
must filter it out, and the partial indexes rely on that filter.

| Entity          | Strategy                                         | Why                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Projects**    | Trash for 30 days, then purged with their files  | Deleting a project destroys a lot of work at once and is easy to do by mistake. `POST /projects/:id/restore` (permission `projects:delete`). The key is released immediately (partial unique index); restoring returns `409` if it was reused meanwhile.                                                                                                                                                |
| **Tasks**       | Trash for 30 days, then purged with their files  | Same reasoning, per task. `POST /tasks/:id/restore` appends the task to its column. Trashing a project trashes its live tasks **with the same timestamp**, so restoring the project brings back exactly those tasks, and not tasks deleted individually earlier.                                                                                                                                        |
| **Comments**    | Hidden at once, purged after 30 days, no restore | Lets moderation be reviewed (moderator deletions are audited) without keeping deleted text indefinitely.                                                                                                                                                                                                                                                                                                |
| **Users**       | Soft delete + anonymization (`DELETE /users/me`) | Users are referenced by comments, tasks, activity and audit entries. Anonymizing (name "Deleted user", tombstone email `deleted+<id>@deleted.invalid`, unusable password, avatar removed) keeps that history intact while removing personal data. Memberships, notifications, tokens and sessions are deleted. The tombstone frees the address for a new sign-up. Owners must transfer ownership first. |
| Organizations   | Hard delete                                      | An owner deleting the tenant is an erasure request. Keeping every row of it "just in case" would contradict that. The platform-level audit entry records the event.                                                                                                                                                                                                                                     |
| Memberships     | Hard delete                                      | Access checks stay a simple existence test; the membership history lives in the activity and audit logs.                                                                                                                                                                                                                                                                                                |
| Everything else | Hard delete or retention jobs                    | Labels, checklist items, attachments, invitations, sessions, tokens, notifications and reports carry little recovery value, or already have retention rules.                                                                                                                                                                                                                                            |

How it works in code:

- `AccessResolver` treats trashed projects and tasks (and comments/attachments under them) as
  **not found**, so nothing nested under a trashed resource is reachable. Only routes marked
  `@AllowDeleted()` (the two restore endpoints) can resolve them.
- Repositories and services add `deletedAt: null` to every task/project/comment read, including
  the raw analytics SQL.
- Deleting and restoring are idempotent `updateMany … WHERE deleted_at IS [NOT] NULL` statements
  inside a transaction with their activity and audit entries.
- The `purge-trash` maintenance job (daily, 03:40 UTC) deletes rows past the retention window. It
  removes stored files before the rows, so a failed run is safely retried. Audit entries are kept
  for 365 days (`cleanup-audit-logs`, 03:50 UTC).

---

## Indexing

Indexes exist for the query patterns the API actually runs. Most list indexes are **partial**
(`WHERE deleted_at IS NULL`): smaller, and exactly matching the queries.

### `tasks`

| Index                                                                                                     | Serves                                                                        |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `(project_id, status, position)` partial                                                                  | Kanban board (one column in order), next position, collision check, rebalance |
| `(organization_id, updated_at DESC, id DESC)` partial                                                     | Organization task list: default sort plus its tie-breaker                     |
| `(organization_id, status)` partial                                                                       | Dashboard counts, status breakdowns                                           |
| `(organization_id, assignee_id, status)`, **not partial**                                                 | "My tasks", workload, **and** the membership FK check / unassignment          |
| `(organization_id, due_date)` partial                                                                     | Overdue, due this week, due-date filters                                      |
| `(organization_id, completed_at)` partial                                                                 | Completion trends and rates                                                   |
| `(organization_id, created_at)` partial                                                                   | Created-per-day series                                                        |
| `tasks_due_soon_idx (due_date) WHERE deleted_at IS NULL AND assignee_id IS NOT NULL AND status <> 'DONE'` | Hourly cross-organization reminder scan: tiny, no full scan                   |
| `(deleted_at) WHERE deleted_at IS NOT NULL`                                                               | Trash purge (only trashed rows)                                               |
| unique `(project_id, number)`                                                                             | Identifiers; also the project FK cascade                                      |
| unique `(id, organization_id)`                                                                            | Target of the composite FKs from attachments and task labels                  |
| GIN `title gin_trgm_ops`                                                                                  | `ILIKE '%…%'` search                                                          |

### Other tables

| Table             | Index                                                                                                                            | Serves                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `projects`        | `(organization_id, status)`, `(organization_id, updated_at)` partial                                                             | Project list filters and default sort                   |
|                   | unique `(organization_id, key)` partial; unique `(id, organization_id)`                                                          | Keys; composite FK target                               |
|                   | GIN `name gin_trgm_ops`; `(deleted_at)` partial                                                                                  | Search; purge                                           |
| `memberships`     | unique `(organization_id, user_id)`; `(user_id)`                                                                                 | Access checks (per request, cached); "my organizations" |
| `project_members` | PK `(project_id, user_id)`; `(user_id, organization_id)`                                                                         | Project members; "projects of user"; membership cascade |
| `task_labels`     | PK `(task_id, label_id)`; `(label_id)`                                                                                           | Labels of a task; label filter; label cascade           |
| `comments`        | `(task_id, created_at)`; `(deleted_at)` partial                                                                                  | Thread order (also the task cascade); purge             |
| `activities`      | `(organization_id, created_at DESC, id DESC)`, `(project_id, …)`, `(task_id, …)`, `(organization_id, actor_id, created_at DESC)` | Keyset-paginated feeds, per-member activity             |
| `notifications`   | `(user_id, created_at DESC, id DESC)`; `(user_id, read_at)`; `(read_at, created_at)`                                             | Inbox feed; unread count; retention                     |
| `audit_logs`      | `(organization_id, created_at DESC, id DESC)`; `(actor_id, created_at DESC)`; `(created_at)`                                     | Audit feed; per-actor filter; retention                 |
| `invitations`     | unique `(organization_id, email)`; `(email)`; `(expires_at)`                                                                     | Pending list; auto-accept on sign-up; cleanup           |
| `sessions`        | `(user_id, revoked_at)`; `(previous_token_hash)`; `(expires_at)`                                                                 | Device list; reuse detection; cleanup                   |

### Deliberately not indexed

- `tasks.reporter_id`, `comments.author_id`, `attachments.uploaded_by_id`: only used by the
  `SET NULL` cascade of a user hard-delete, which the application never performs.
- `attachments.organization_id`, `notifications.organization_id`: only used by the cascade when a
  whole organization is deleted, a rare owner action. An index would tax every insert to serve it.
- Low-selectivity columns alone (`status`, `priority`) are only indexed behind an
  `organization_id`/`project_id` prefix, never on their own.

Foreign-key checks and cascades can't use partial indexes. That's why the indexes serving them
(`(organization_id, assignee_id, status)`, `(task_id, created_at)`, the unique keys) are full.

---

## Transactions

Rules the code follows:

1. **A change and its history commit together.** Writes run in `prisma.$transaction(async (tx) =>
…)` with their activity entries and audit entries (`ActivityService.record(…, tx)`,
   `AuditService.record(…, tx)`). An audit entry exists if and only if the change happened.
2. **Side effects happen after commit:** notifications (queued), cache invalidation, real-time
   events, email and object-storage cleanup. A Redis hiccup never rolls back or fails a committed
   change.
3. **Keep transactions short.** Slow work (Argon2 hashing, uploads to S3, presigning) happens
   before the transaction opens.
4. **Concurrency:**
   - Task numbers: `UPDATE projects SET task_sequence = task_sequence + 1 … RETURNING` row-locks
     the project, which serializes numbering within it.
   - Refresh-token rotation: compare-and-swap `updateMany` on the current hash.
   - Single-use tokens: `updateMany … WHERE consumed_at IS NULL`.
   - Soft delete/restore: conditional `updateMany` (idempotent; a second delete is 404).
   - Unique races (duplicate invitation, project key, label name, slug): the constraint decides,
     and the error maps to `409`.

| Operation                              | Atomic unit                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| Create task                            | lock project + next number + insert task + labels + activity                         |
| Update / move task                     | task update (+ label replace, + column rebalance) + activity                         |
| Trash / restore project                | project + its tasks (shared timestamp) + activity + audit                            |
| Remove member / leave / delete account | unassign tasks → delete membership (cascades project memberships) + activity + audit |
| Invite                                 | drop expired invitations + insert batch + activity + audit                           |
| Accept invitation                      | delete invitation + create membership + activity + audit                             |
| Transfer ownership                     | both role changes + activity + audit                                                 |
| Reset / change password                | consume token + update user + audit                                                  |
| Migrations                             | each migration file runs as one transaction                                          |
| Seed                                   | the whole seed is one transaction                                                    |

Timeouts guard against runaway work: `statement_timeout` is 30 s and
`idle_in_transaction_session_timeout` is 60 s (set on each pool connection). Prisma interactive
transactions default to a 5 s timeout.

---

## Performance

**N+1 review.** Findings and fixes:

- _Fixed:_ reordering a Kanban column issued one `UPDATE` per task. `rebalanceColumn` is now a
  single `UPDATE … FROM (SELECT row_number() OVER …)`, whatever the column length.
- _Fixed:_ inviting N addresses issued N `INSERT`s. It's now one `createManyAndReturn`.
- _Verified:_ project task stats use two grouped queries for any number of projects. List
  endpoints load relations with one query per relation, not per row. Notification delivery and
  activity use bulk inserts. Analytics use grouped counts or SQL aggregates.
- _Accepted:_ task lists load each task's checklist `completed` flags to compute "3/5" (one batched
  query), and the due-date scan does one Redis `SET NX` per task (Redis, not PostgreSQL).

**Joins.** `organization_id` is denormalized so tenant-wide lists, counts and analytics hit one
table. Includes select only the columns the DTOs need (`userSummarySelect`, `labelSelect`).

**Pagination.**

- Collections (projects, organization tasks) use offset pagination (`page`, `pageSize ≤ 100`)
  with a unique tie-breaker (`id`), so pages are stable. This is the contract the web client uses.
- Feeds (activity, notifications, audit log) use keyset cursors on `(created_at, id)`, backed by
  the `(…, created_at DESC, id DESC)` indexes. They stay fast at any depth and never skip or
  duplicate rows under concurrent inserts.
- The project board returns a whole project (capped at 5,000 tasks). Batch jobs (CSV export, due
  scan, purge) walk the table by id in fixed-size batches.

**Connection pooling.** Each process (API or worker) holds one `pg` pool of `DATABASE_POOL_SIZE`
connections (default 10; 5 s connect timeout, 30 s idle timeout). Size it so
`(API instances + worker instances) × DATABASE_POOL_SIZE` stays below PostgreSQL's
`max_connections`, with headroom for migrations and admin sessions. At larger scale, put
PgBouncer (transaction mode) or RDS Proxy in front. With PgBouncer, add `statement_timeout` and
`idle_in_transaction_session_timeout` to its `ignore_startup_parameters` and set them on the
database role instead (`ALTER ROLE flowsync SET statement_timeout = '30s'`).

---

## Migrations

| Migration                                               | Contents                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `20260926053302_init`                                   | Initial schema, `pg_trgm`, trigram indexes                                                                                                                                                                                                 |
| `20260926130000_tenant_integrity_soft_delete_audit_log` | Composite tenant FKs; `organization_id` on `project_members`/`task_labels` (backfilled); `deleted_at` on users/projects/tasks/comments; partial indexes; unique invitations; CHECK constraints; `audit_logs` with its immutability trigger |

The second migration is safe on populated databases. It backfills the new NOT NULL columns before
enforcing them, and normalizes existing rows to invariants the application already maintains:
lower-cased emails, one invitation per address, `completed_at` consistent with `DONE`, due date
not before start date. It also drops links that cross organizations: labels from another
organization, project members or assignees who are no longer members. Rows that can't be repaired
mechanically, such as a task whose organization differs from its project's, make it fail. The
whole file runs in one transaction, so a failure leaves the database untouched. It was verified
on an empty database and on a database seeded under the previous schema.

### Everyday workflow

```bash
# Change prisma/schema.prisma, then create + apply a migration locally:
npm run prisma:migrate -- --name add_something

# Check the migrations and the schema agree (prints "-- This is an empty migration."):
npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script

# Check a migrated database matches the schema (exit code 2 = drift):
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code

# CI/CD and production: apply pending migrations before rolling out a release.
npm run prisma:deploy        # or run the Docker `migrate` target as a one-off job
```

### Validation in CI

Every pull request (`.github/workflows/ci.yml`, job _database validation + integration tests_)
starts an empty PostgreSQL, then runs `prisma validate`, applies every migration with
`migrate deploy` (exactly what a release does), fails on drift between the migrations, the schema
and the migrated database (`migrate diff … --exit-code`, both directions), seeds twice to prove the
seed is idempotent, and runs the API integration tests against that stack. The integration suite
creates its own throwaway database with `migrate deploy` for every run.

- **Never edit a migration that has been applied anywhere**; add a new one. Don't use
  `prisma migrate reset` on shared databases.
- `prisma migrate dev` needs a shadow database. It creates one itself if the role may
  `CREATE DATABASE`; otherwise set `SHADOW_DATABASE_URL`.
- Hand-written SQL (CHECK constraints, triggers, backfills) goes into the generated migration
  file before it is applied (`--create-only`, edit, then `migrate dev`). Prisma ignores CHECK
  constraints and triggers when diffing, so they are never dropped.
- Partial-index predicates in `schema.prisma` must be written in PostgreSQL's normalized form (as
  in `tasks_due_soon_idx`), or `migrate diff` reports a perpetual change.
- On large production tables, create indexes with `CREATE INDEX CONCURRENTLY`, each in a migration
  file of its own (it can't run inside the multi-statement transaction a migration file uses).
  Add constraints as `NOT VALID`, then `VALIDATE CONSTRAINT` in a later migration.

---

## Seed data

`npm run db:seed` fills an empty development database. It refuses to run when
`NODE_ENV=production` (unless `SEED_ALLOW_PRODUCTION=true`), skips if the demo user already
exists, and runs in a single transaction.

Every account is fake and shares the development password `Password123!`. Teammates use reserved
`.example` domains (RFC 2606), so no email can ever reach a real inbox.

| Account                        | Organizations (role)              | Notes                                   |
| ------------------------------ | --------------------------------- | --------------------------------------- |
| `demo@flowsync.dev`            | Acme (OWNER), Northwind (MEMBER)  | The documented demo sign-in             |
| `priya.sharma@acme.example`    | Acme (ADMIN)                      |                                         |
| `marcus.chen@acme.example`     | Acme (MANAGER)                    |                                         |
| `sofia.rodriguez@acme.example` | Acme (MEMBER)                     |                                         |
| `james.okafor@acme.example`    | Acme (MEMBER), Northwind (MEMBER) |                                         |
| `olivia.brown@acme.example`    | Acme (VIEWER)                     |                                         |
| `hana.sato@northwind.example`  | Northwind (OWNER)                 | Second tenant, for isolation testing    |
| `pending@flowsync.dev`         | none                              | Unverified: shows the verify-email flow |

Content: 2 organizations with 5 labels each; 4 projects (WEB, API, MOB, DATA) with 22 tasks
across every status and priority, one of them in the trash (WEB-9); a checklist; comment threads
with mentions; 5 notifications for the demo user (read and unread); a pending invitation; activity
history; and a few audit-log entries.
