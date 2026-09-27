import type { AccessContext, AuthUser } from '../common/auth/auth.types.js';

declare global {
  namespace Express {
    /** Populated by the JWT strategy for authenticated requests. */
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthUser {}

    interface Request {
      /** Organization-scoped access, resolved by `AccessGuard` from route params. */
      access?: AccessContext;
    }
  }
}

export {};
