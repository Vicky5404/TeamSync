import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ALLOW_DELETED_KEY, IS_PUBLIC_KEY, PERMISSION_KEY } from '../auth/decorators.js';
import { Errors } from '../errors/api-exception.js';
import { requestClient } from '../http/client-context.js';

import { AccessResolver, SCOPE_PARAMS } from './access-resolver.service.js';
import { hasPermission, type Permission } from './permissions.js';

/**
 * Global guard (runs after JWT authentication). Secure by default: every route
 * whose params reference an organization-owned resource is checked for
 * membership, whether or not it declares a permission. `@RequirePermission`
 * additionally enforces the role-based permission.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: AccessResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      targets,
    );
    const request = context.switchToHttp().getRequest<Request>();
    const params = request.params as Record<string, string | undefined>;
    const hasScope = SCOPE_PARAMS.some((param) => params[param] !== undefined);

    if (!hasScope) {
      if (permission) {
        throw new Error(
          `@RequirePermission('${permission}') used on a route without an organization scope`,
        );
      }
      return true;
    }

    if (!request.user) throw Errors.unauthorized();
    const includeDeleted =
      this.reflector.getAllAndOverride<boolean>(ALLOW_DELETED_KEY, targets) ?? false;
    const access = await this.resolver.resolve(params, request.user.id, { includeDeleted });
    if (permission && !hasPermission(access.role, permission)) throw Errors.forbidden();
    request.access = { ...access, client: requestClient(request) };
    return true;
  }
}
