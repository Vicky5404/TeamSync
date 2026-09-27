# FlowSync — Web Client

Frontend for **FlowSync**, a real-time collaborative work management platform: organizations,
projects, Kanban boards, task details, team management, notifications and analytics.

- **Stack:** React 19 · TypeScript (strict) · Vite 8 · React Router 7 · Tailwind CSS 4 ·
  TanStack Query 5 · Zustand 5 · React Hook Form + Zod 4 · Axios · Recharts 3 · dnd-kit · Lucide
- **Status:** integrated with the real API in [`backend/`](../backend/README.md) — REST, WebSocket
  real-time events and background-worker side effects (notifications, emails).

---

## Getting started

**Prerequisites:** Node.js **≥ 22.12** (required by Vite 8), npm 10+, and the API running on
`http://localhost:4000` (see [`backend/README.md`](../backend/README.md#getting-started)).

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

`npm run dev` uses `.env.development`: the dev server proxies `/api` and `/ws` to the backend, so
cookies, CORS and the WebSocket origin check stay same-origin. With the seeded database
(`npm run db:seed` in `backend/`) you can sign in with:

| Account                | Email                  | Password       | Notes                                                |
| ---------------------- | ---------------------- | -------------- | ---------------------------------------------------- |
| Demo user              | `demo@flowsync.dev`    | `Password123!` | Owner of _Acme Inc._, Member of _Northwind Labs_     |
| Unverified (edge case) | `pending@flowsync.dev` | `Password123!` | Demonstrates the “verify your email” flow on sign-in |

Emails (verification, password reset, invitations) land in Mailpit at http://localhost:8025.
Switch organizations from the sidebar to see permission-aware UI (e.g. Member vs Owner).

### Scripts

| Command                | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| `npm run dev`          | Start the Vite dev server with HMR                          |
| `npm run build`        | Type-check (`tsc -b`) and create a production build         |
| `npm run preview`      | Serve the production build locally (port 4173)              |
| `npm run typecheck`    | Full TypeScript check (`tsc -b --force`)                    |
| `npm run lint`         | ESLint (type-aware, React Hooks/Compiler rules), 0 warnings |
| `npm run lint:fix`     | ESLint with autofix                                         |
| `npm run format`       | Prettier (with Tailwind class sorting)                      |
| `npm run format:check` | Verify formatting (CI)                                      |
| `npm test`             | Unit and component tests (Vitest + Testing Library, jsdom)  |
| `npm run test:watch`   | Tests in watch mode                                         |
| `npm run test:cov`     | Tests with coverage (CI)                                    |

---

## Environment variables

Copy `.env.example` to `.env.local` (or `.env.development.local`; both git-ignored) to override
values. Only `VITE_*` variables are exposed to the browser bundle — **never put secrets in them**;
the web client needs none (database, Redis, JWT, S3 and SMTP secrets live only in `backend/.env`).
Values are validated at startup with Zod (`src/lib/env.ts`); invalid configuration fails fast with a
descriptive error.

| Variable                       | Default                 | Description                                                                                                                                     |
| ------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_APP_NAME`                | `FlowSync`              | Product name used in the UI and document titles                                                                                                 |
| `VITE_API_BASE_URL`            | `/api/v1`               | REST API base URL (absolute, or relative when served behind a proxy)                                                                            |
| `VITE_API_TIMEOUT_MS`          | `15000`                 | Request timeout (uploads have no timeout)                                                                                                       |
| `VITE_WS_URL`                  | `/ws`                   | WebSocket endpoint: `wss://…` or a same-origin path (`/ws` becomes `ws:`/`wss:` like the page). Empty disables real-time; the app polls instead |
| `VITE_UPLOAD_MAX_FILE_SIZE_MB` | `25`                    | Attachment size checked before uploading — keep in sync with the API's `UPLOAD_MAX_FILE_SIZE_MB`                                                |
| `DEV_API_PROXY_TARGET`         | `http://localhost:4000` | **Dev server only.** Proxies `/api` and `/ws` to the backend                                                                                    |

---

## Project structure

```
src/
  app/            App shell: providers, QueryClient config, router, theme sync
  components/
    ui/           Design system (Button, Input, Select, Modal, Drawer, Dropdown, Tooltip,
                  Avatar, Badge, Table, Tabs, Skeleton, EmptyState, ErrorState, Toaster…)
    charts/       Reusable Recharts wrappers (ChartCard, TrendLineChart, StackedBarChart…)
    common/       Shared composites (PageHeader, SearchInput, StatCard, MultiSelectFilter…)
  features/       Domain modules — each owns its api hooks, components, pages and schemas
    auth/ dashboard/ organizations/ projects/ tasks/ comments/ notifications/
    team/ settings/ activity/ search/
  hooks/          Generic hooks (overlay/focus management, positioning, hotkeys, debounce…)
  layouts/        AuthLayout, AppLayout (sidebar, mobile nav, top bar, breadcrumbs)
  lib/            Infrastructure: env, HTTP client, query keys, permissions, realtime, forms
  routes/         Route guards, paths, breadcrumbs, error boundary, 404
  services/       Typed API modules (auth, users, organizations, projects, tasks, comments,
                  notifications, files, analytics, search)
  store/          Zustand stores (auth session, UI, organization selection, toasts)
  types/          Domain & API contract types shared by services and features
  utils/          Pure helpers (dates, formatting, URL params, strings)
```

Features import shared code from `components/`, `hooks/`, `lib/`, `services/` and `types/`.
Cross-feature imports are limited to public building blocks (e.g. `useActiveOrganization`).

---

## Architecture

### Server state vs. client state

- **TanStack Query** owns all server data (caching, background refetch, mutations,
  invalidation). Query keys are centralized in `src/lib/query-keys.ts` and are hierarchical so
  related caches can be invalidated by prefix.
- **Zustand** holds only client state: the in-memory access token and session status,
  sidebar / mobile-nav / search UI state, the selected organization, theme, and toasts.
- **URL** holds shareable state: task & project filters, sorting, pagination, tabs, and the open
  task (`?task=<id>`), so every view can be deep-linked and survives reloads/back navigation.

### API layer & authentication

- `src/lib/http/client.ts` configures Axios: base URL, timeout, `withCredentials`, request ids,
  bearer token injection and array param serialization.
- The **access token lives in memory only**. The API is expected to set the refresh token as an
  **httpOnly, Secure, SameSite cookie**; on startup `SessionManager` calls `POST /auth/refresh`
  to restore the session.
- A 401 triggers a **single-flight refresh** (concurrent 401s share one refresh) and the original
  request is retried once; if refresh fails the session ends and the user is sent to sign in.
- Every error is normalized to `ApiError` (`status`, `code`, `message`, `fieldErrors`,
  `requestId`). Forms map `fieldErrors` onto fields (`applyFormError`); other mutation failures
  surface as toasts via the global `MutationCache` handler (titled by cause — offline, permission
  denied, conflict… — with the request id for 5xx); queries render inline error states with a retry
  action, and a failed background refresh keeps the last data on screen with a "couldn't refresh"
  notice. A 404/409 from a mutation (someone else deleted or changed the target) refreshes the
  queries on screen.
- Failed requests are logged to the console for developers as
  `[api] METHOD /path failed: status code · message · request <id>` (4xx in development only;
  network errors and 5xx always), so they can be matched with the API's structured logs via
  `X-Request-Id`.
- If the API is unreachable on startup the session is **kept**: the app explains the problem and
  retries restoring it with backoff instead of signing the user out.

### Optimistic UI

Kanban moves, task field edits, checklist toggles, comments, role changes and notification
read-state update the cache immediately and roll back on failure. Board moves use fractional
positions (`position` between neighbours); a failed move reverts only that card (with an error
toast) and the board reconciles with the server once the last queued move settles. Comment and
attachment counters are adjusted before the request, because the API broadcasts the absolute
counts over the WebSocket — possibly before the HTTP response arrives.

### Permissions

`src/lib/permissions.ts` maps roles (`OWNER`, `ADMIN`, `MANAGER`, `MEMBER`, `VIEWER`) to
permissions. `usePermissions()` / `<Can permission="…">` hide or disable actions. This is UX only —
**the API must enforce the same rules.**

### Real-time

`src/lib/realtime` contains a framework-agnostic WebSocket client (auth handshake, channel
subscriptions, exponential backoff with jitter, heartbeat, immediate reconnect when the browser comes
back online) and a `RealtimeProvider`. When the server rejects an expired token (close code `4401`)
the client refreshes the session and reconnects. Features register handlers that write events
straight into the query cache (`features/*/realtime.ts`): boards, open drawers and comment threads
update in place; only filtered lists whose membership may have changed refetch, and derived data
(analytics, project progress) refreshes once per burst of events. Echoes of this client's own
in-flight changes are ignored. When `VITE_WS_URL` is empty or disconnected, the unread badge falls
back to polling.

Protocol (JSON messages; see `backend/src/modules/realtime`):

```jsonc
// client → server
{ "type": "auth", "token": "<access token>" }            // → { "type": "ready" }
{ "type": "subscribe", "channel": "organization:<id>" }  // or "project:<id>"
{ "type": "ping" }                                       // → { "type": "pong" }
// server → client
{ "type": "notification.created", "payload": Notification }  // private user channel
{ "type": "task.created" | "task.updated" | "task.moved", "payload": Task }
{ "type": "task.deleted", "payload": { "id": "…", "projectId": "…" } }
{ "type": "comment.created", "payload": Comment }
{ "type": "member.updated", "payload": { "organizationId": "…", "action": "joined" | "updated" | "removed", "member"?: Member, "userId"?: "…" } }
{ "type": "project.updated", "payload": { "id": "…", "deleted"?: true } }
```

### UX & accessibility

Every data view has loading skeletons, empty states, error states with retry, and confirmation
dialogs for destructive actions. Overlays trap focus, close on Escape and restore focus; menus,
tabs, segmented controls and the command palette follow WAI-ARIA keyboard patterns. The Kanban
board supports keyboard dragging (Space to pick up/drop, arrows to move, Enter to open) with
screen-reader announcements. Charts have a table view toggle, and route changes are announced.
Motion is minimal and disabled under `prefers-reduced-motion`.

---

## REST API contract

All endpoints are relative to `VITE_API_BASE_URL`. Types live in `src/types`. Error responses use
`{ code, message, fieldErrors?, requestId? }`. Lists use `{ data, meta: { page, pageSize, total,
totalPages } }`; feeds use `{ data, nextCursor }`. Array query params repeat the key
(`status=TODO&status=DONE`).

| Area          | Endpoints                                                                                                                                                                                                                                                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth          | `POST /auth/login` · `POST /auth/register` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/forgot-password` · `POST /auth/reset-password` · `POST /auth/verify-email` · `POST /auth/resend-verification`                                                                                                                                                    |
| Users         | `PATCH /users/me` · `POST /users/me/password` · `GET/DELETE /users/me/sessions` · `DELETE /users/me/sessions/:id` · `POST/DELETE /users/me/avatar` · `GET/PUT /users/me/notification-preferences`                                                                                                                                                                                       |
| Organizations | `GET/POST /organizations` · `PATCH/DELETE /organizations/:orgId` · `POST /organizations/:orgId/leave` · `POST /invitations/accept` · `GET /organizations/:orgId/members` · `GET/PATCH/DELETE /organizations/:orgId/members/:memberId` · `GET/POST /organizations/:orgId/invitations` · `POST …/invitations/:id/resend` · `DELETE …/invitations/:id` · `GET …/labels` · `GET …/activity` |
| Projects      | `GET/POST /organizations/:orgId/projects` · `GET/PATCH/DELETE /projects/:projectId` · `GET /projects/:projectId/activity` · `GET /projects/:projectId/analytics`                                                                                                                                                                                                                        |
| Tasks         | `GET/POST /projects/:projectId/tasks` · `GET /organizations/:orgId/tasks` · `GET/PATCH/DELETE /tasks/:taskId` · `POST /tasks/:taskId/move` · `GET /tasks/:taskId/activity` · `POST /tasks/:taskId/checklist` · `PATCH/DELETE /tasks/:taskId/checklist/:itemId`                                                                                                                          |
| Comments      | `GET/POST /tasks/:taskId/comments` · `PATCH/DELETE /comments/:commentId`                                                                                                                                                                                                                                                                                                                |
| Files         | `GET/POST /tasks/:taskId/attachments` (multipart field `file`) · `GET /attachments/:id/download` (fresh presigned URL) · `DELETE /attachments/:id`                                                                                                                                                                                                                                      |
| Notifications | `GET /notifications?filter=all\|unread&cursor&limit` · `GET /notifications/unread-count` · `POST /notifications/:id/read` · `POST /notifications/read-all`                                                                                                                                                                                                                              |
| Analytics     | `GET /organizations/:orgId/analytics/dashboard` · `…/task-completion?days=7\|14\|30\|90` · `…/workload` · `…/project-progress`                                                                                                                                                                                                                                                          |
| Search        | `GET /organizations/:orgId/search?q&limit`                                                                                                                                                                                                                                                                                                                                              |

The API's Swagger UI (`http://localhost:4000/api/v1/docs`) documents every request/response
shape, validation rule and error.

---

## Testing

```bash
npm test             # all tests (~10 s)
npm run test:cov     # with coverage
```

Tests live next to the code they cover (`*.test.ts(x)`); shared helpers are in `src/test/`
(`renderWithProviders`, `renderRoutes`, task/user fixtures, jsdom polyfills). Covered today:

| Area                 | Tests                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication flows | Login page (validation, success + redirect to the original page, wrong password, unverified email, session-expired notice), route guards |
| HTTP layer           | Bearer + request id headers, single-flight refresh on concurrent 401s, session expiry, public endpoints, error normalization             |
| Real-time client     | Auth handshake, re-subscription, 4401 refresh + reconnect, in-place `reauth`, resync after reconnect, no refresh loops                   |
| Task board           | Column grouping/order, fractional positions, optimistic move + rollback, card rendering (incl. text never rendered as HTML)              |
| Forms                | Auth schemas, create-task modal (validation, payload mapping, server field errors)                                                       |
| Permissions          | Role table parity with the API, `<Can>` gating                                                                                           |

Mock the service layer (`vi.mock('@/services', …)`) rather than HTTP when testing components.

---

## Production build & deployment

```bash
npm run build      # outputs dist/
npm run preview    # smoke-test the build locally
docker build -t flowsync-web .   # nginx image: SPA + /api and /ws reverse proxy (port 8080)
```

- Routes are code-split per page; Recharts and dnd-kit load only on the pages that use them.
- The Docker image ([`Dockerfile`](Dockerfile), [`nginx/`](nginx/)) serves the SPA with a fallback
  to `index.html`, caches `assets/*` immutably, never caches `index.html`, proxies `/api` and `/ws`
  to `API_UPSTREAM`, applies edge rate limits and sends security headers including a strict
  Content-Security-Policy (`script-src 'self'` — the theme bootstrap is the static
  `public/theme-init.js`, not an inline script). Set `CSP_IMG_SRC` to the object-storage origin so
  avatars and image previews load.
- Source maps are emitted as `hidden` in production (upload them to your error tracker); the
  Docker image deletes them.
- Deployment topology and settings: [`docs/deployment.md`](../docs/deployment.md).

---

## Adding a feature

1. Add/extend types in `src/types` and the typed service in `src/services`.
2. Add query keys to `src/lib/query-keys.ts`.
3. Create `src/features/<name>/` with `api/*.queries.ts` (hooks), `components/`, `pages/` and
   `schemas.ts` (Zod) as needed.
4. Register lazy routes in `src/app/router.tsx` (with a breadcrumb `handle`) and paths in
   `src/routes/paths.ts`.
5. If the API broadcasts an event for it, handle it in `src/features/<name>/realtime.ts` and
   register the handler in `src/layouts/AppLayout.tsx`.
