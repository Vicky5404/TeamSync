import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import type { AppConfig } from '../config/app-config.js';

const DESCRIPTION = `
REST API for FlowSync, a real-time collaborative work management platform.

## Authentication

1. \`POST /auth/login\` with \`{ email, password, rememberMe }\` returns \`{ accessToken, expiresIn, user }\`
   and sets the refresh token as an **httpOnly** cookie scoped to \`/<prefix>/auth\`.
2. Send the access token on every other request: \`Authorization: Bearer <accessToken>\`.
   Access tokens are short-lived JWTs (HS256, 15 minutes by default).
3. On \`401\`, call \`POST /auth/refresh\` (the browser sends the cookie) to get a new access token.
   Refresh tokens rotate on every use; replaying an old one revokes the whole session.
4. \`POST /auth/logout\` revokes the session. Logout, password changes and session revocation take
   effect immediately, including for open WebSocket connections.

Cookie-authenticated endpoints (\`/auth/refresh\`, \`/auth/logout\`) reject requests whose \`Origin\` is
not an allowed web origin (CSRF protection). New accounts must verify their email before signing in.

## Authorization

Organization roles: \`OWNER\` > \`ADMIN\` > \`MANAGER\` > \`MEMBER\` > \`VIEWER\`. Every route that names an
organization-owned resource checks membership of *that resource's* organization: resources of other
organizations return **404** (their existence is never revealed); missing permissions return **403**.

## Conventions

- **Errors:** every non-2xx response is \`{ code, message, fieldErrors?, requestId }\`. Validation errors are
  \`422 VALIDATION_ERROR\` with per-field messages; unknown fields are rejected.
- **Request ids:** every response carries \`X-Request-Id\` (a well-formed incoming one is reused) — quote it
  when reporting problems; it appears in the server logs.
- **Rate limits:** \`429 RATE_LIMITED\` with \`Retry-After\`. Sign-in, registration and email flows have
  stricter per-client limits; repeated failed sign-ins lock the account temporarily (\`ACCOUNT_LOCKED\`).
- **Pagination:** lists return \`{ data, meta: { page, pageSize, total, totalPages } }\`; feeds (activity,
  notifications) return \`{ data, nextCursor }\`. Array query parameters repeat the key (\`status=TODO&status=DONE\`).
- **Dates:** \`YYYY-MM-DD\` for due/start dates (UTC calendar dates), ISO-8601 timestamps otherwise.

## Real-time

WebSocket at \`/ws\`: send \`{ "type": "auth", "token": "<accessToken>" }\` (→ \`ready\`), then
\`{ "type": "subscribe", "channel": "organization:<id>" | "project:<id>" }\`. The server asks for a fresh token
with \`{ "type": "reauth" }\` before the current one expires. See \`docs/realtime.md\`.
`.trim();

const TAGS: Array<[name: string, description: string]> = [
  ['Authentication', 'Sign-up, email verification, sign-in, token refresh and password reset'],
  ['Users', 'The signed-in user: profile, avatar, password, device sessions, account deletion'],
  ['Organizations', 'Workspaces, ownership transfer, invitations and membership'],
  ['Projects', 'Projects and their members (trash with 30-day restore)'],
  ['Tasks', 'Kanban tasks: CRUD, board moves, assignment, labels, checklists (trash with restore)'],
  ['Comments', 'Task comments with @mentions'],
  ['Labels', 'Organization-wide task labels'],
  ['Notifications', 'In-app notifications and per-type delivery preferences'],
  ['Files', 'Task attachments in private object storage (content-verified, presigned URLs)'],
  ['Activity', 'Collaboration history feeds'],
  ['Audit log', 'Immutable security and administration trail (owners and admins)'],
  ['Analytics', 'Dashboards, workload and CSV report exports'],
  ['Search', 'Organization-wide search across projects, tasks and members'],
  ['Health', 'Liveness and readiness probes (outside the API prefix)'],
];

/** OpenAPI document + Swagger UI at `/<prefix>/<SWAGGER_PATH>` (JSON at `…-json`). */
export function setupSwagger(app: INestApplication, config: AppConfig): void {
  const builder = new DocumentBuilder()
    .setTitle('FlowSync API')
    .setDescription(DESCRIPTION)
    .setVersion(process.env.APP_VERSION ?? '1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Access token from `POST /auth/login` or `POST /auth/refresh`',
    })
    .addCookieAuth(
      config.auth.cookie.name,
      {
        type: 'apiKey',
        in: 'cookie',
        description: 'httpOnly refresh-token cookie (auth routes only)',
      },
      'refresh-token',
    );
  for (const [name, description] of TAGS) builder.addTag(name, description);

  const document = SwaggerModule.createDocument(app, builder.build());
  SwaggerModule.setup(config.http.swaggerPath, app, document, {
    useGlobalPrefix: true,
    jsonDocumentUrl: `${config.http.swaggerPath}-json`,
    swaggerOptions: { persistAuthorization: false, displayRequestDuration: true },
  });
}
