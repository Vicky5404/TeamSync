import type { Role } from '../../generated/prisma/enums.js';

/** Identity attached to authenticated requests (from the access-token claims). */
export interface AuthUser {
  id: string;
  /** Device session the access token was issued for. */
  sessionId: string;
}

/** Claims carried by access tokens. */
export interface AccessTokenPayload {
  sub: string;
  sid: string;
  typ: 'access';
}

/** Where a request came from; recorded with audit-log entries. */
export interface RequestClient {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
}

/**
 * Result of resolving the organization a request targets and the caller's
 * membership in it. Services receive this instead of trusting raw params.
 */
export interface AccessContext {
  userId: string;
  organizationId: string;
  membershipId: string;
  role: Role;
  /** Set when the route targets a project or something inside one. */
  projectId?: string;
  /** Set when the route targets a task or something attached to one. */
  taskId?: string;
  /** Request metadata (set by `AccessGuard` for HTTP requests). */
  client?: RequestClient;
}
