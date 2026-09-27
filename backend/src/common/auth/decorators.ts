import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  InternalServerErrorException,
  SetMetadata,
} from '@nestjs/common';
import { ApiForbiddenResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import type { Request } from 'express';

import { ApiErrorDto } from '../dto/api-error.dto.js';
import { Errors } from '../errors/api-exception.js';
import type { Permission } from '../authorization/permissions.js';

import type { AccessContext, AuthUser } from './auth.types.js';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const PERMISSION_KEY = 'auth:permission';
export const ALLOW_DELETED_KEY = 'auth:allowDeleted';

/** Skip JWT authentication for this route (e.g. login, health checks). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Let `AccessGuard` resolve a soft-deleted project or task (restore routes).
 * Everywhere else, resources in the trash are treated as not found.
 */
export const AllowDeleted = () => SetMetadata(ALLOW_DELETED_KEY, true);

/**
 * Require an organization-level permission. The organization is resolved from
 * the route params (`organizationId`, `projectId`, `taskId`, `commentId`,
 * `attachmentId`) by `AccessGuard`; non-members get 404, members without the
 * permission get 403.
 */
export const RequirePermission = (permission: Permission) =>
  applyDecorators(
    SetMetadata(PERMISSION_KEY, permission),
    ApiForbiddenResponse({
      description: `Requires the \`${permission}\` permission.`,
      type: ApiErrorDto,
    }),
    ApiNotFoundResponse({
      description: 'Not found, or not a member of the organization.',
      type: ApiErrorDto,
    }),
  );

/** The authenticated user. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<Request>();
  if (!request.user) throw Errors.unauthorized();
  return request.user satisfies AuthUser;
});

/** The resolved organization access context (requires an organization-scoped route). */
export const Access = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<Request>();
  if (!request.access) {
    throw new InternalServerErrorException(
      'Access context requested on a route without an organization scope',
    );
  }
  return request.access satisfies AccessContext;
});
