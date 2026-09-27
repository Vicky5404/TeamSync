import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthUser } from '../../common/auth/auth.types.js';
import { CurrentUser } from '../../common/auth/decorators.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { Errors } from '../../common/errors/api-exception.js';
import { requestClient } from '../../common/http/client-context.js';
import { uuidParam } from '../../common/pipes/uuid-param.pipe.js';

import { AuthService } from './auth.service.js';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  RevokeSessionsQueryDto,
  UserSessionDto,
} from './dto/auth.dto.js';
import { SessionsService } from './sessions.service.js';

/** Password and device-session management for the signed-in user. */
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users/me')
export class AccountSecurityController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Change password (signs out all other sessions)' })
  @ApiNoContentResponse()
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() input: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    return this.auth.changePassword(user.id, user.sessionId, input, requestClient(request));
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiOperation({
    summary: 'Delete my account',
    description:
      'Requires the current password. Removes all memberships and signs out every session; ' +
      'content you created stays, attributed to "Deleted user". Organization owners must ' +
      'transfer ownership first.',
  })
  @ApiNoContentResponse()
  @ApiConflictResponse({ type: ApiErrorDto, description: 'You still own an organization' })
  deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body() input: DeleteAccountDto,
    @Req() request: Request,
  ): Promise<void> {
    return this.auth.deleteAccount(user.id, input.password, requestClient(request));
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Active device sessions' })
  @ApiOkResponse({ type: [UserSessionDto] })
  listSessions(@CurrentUser() user: AuthUser): Promise<UserSessionDto[]> {
    return this.sessions.list(user.id, user.sessionId);
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out every other session (`?scope=others`)' })
  @ApiNoContentResponse()
  async revokeOtherSessions(
    @CurrentUser() user: AuthUser,
    @Query() query: RevokeSessionsQueryDto,
  ): Promise<void> {
    if (query.scope !== 'others') throw Errors.field('scope', 'Only scope=others is supported');
    await this.sessions.revokeOthers(user.id, user.sessionId);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out one session' })
  @ApiNoContentResponse()
  revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('sessionId', uuidParam('Session')) sessionId: string,
  ): Promise<void> {
    return this.sessions.revoke(user.id, sessionId);
  }
}
