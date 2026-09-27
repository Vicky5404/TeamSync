import type { Request } from 'express';

import type { ClientContext } from '../../modules/auth/sessions.service.js';
import type { RequestClient } from '../auth/auth.types.js';

/** Caller IP (honours `trust proxy`) and user agent for session bookkeeping. */
export function clientContext(request: Request): ClientContext {
  const userAgent = request.headers['user-agent'];
  return {
    ipAddress: request.ip,
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
  };
}

/** Caller IP, user agent and request id, truncated to the audit-log column sizes. */
export function requestClient(request: Request): RequestClient {
  const { ipAddress, userAgent } = clientContext(request);
  return {
    ipAddress: ipAddress?.slice(0, 64) ?? null,
    userAgent: userAgent?.slice(0, 512) ?? null,
    requestId: typeof request.id === 'string' ? request.id.slice(0, 128) : null,
  };
}
