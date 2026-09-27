import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AccessContext, AuthUser } from '../../common/auth/auth.types.js';
import { Access, CurrentUser, RequirePermission } from '../../common/auth/decorators.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';

import {
  AcceptInvitationDto,
  CreateOrganizationDto,
  OrganizationDto,
  TransferOwnershipDto,
  UpdateOrganizationDto,
} from './dto/organization.dto.js';
import { InvitationsService } from './invitations.service.js';
import { OrganizationsService } from './organizations.service.js';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller()
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly invitations: InvitationsService,
  ) {}

  @Get('organizations')
  @ApiOperation({ summary: 'Organizations the current user belongs to (with their role)' })
  @ApiOkResponse({ type: [OrganizationDto] })
  list(@CurrentUser() user: AuthUser): Promise<OrganizationDto[]> {
    return this.organizations.listForUser(user.id);
  }

  @Post('organizations')
  @ApiOperation({ summary: 'Create an organization (the creator becomes its owner)' })
  @ApiCreatedResponse({ type: OrganizationDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Slug already taken' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() input: CreateOrganizationDto,
  ): Promise<OrganizationDto> {
    return this.organizations.create(user.id, input);
  }

  @Get('organizations/:organizationId')
  @ApiOperation({ summary: 'Get an organization' })
  @ApiOkResponse({ type: OrganizationDto })
  get(@Access() access: AccessContext): Promise<OrganizationDto> {
    return this.organizations.get(access);
  }

  @Patch('organizations/:organizationId')
  @RequirePermission('organization:update')
  @ApiOperation({ summary: 'Update an organization' })
  @ApiOkResponse({ type: OrganizationDto })
  update(
    @Access() access: AccessContext,
    @Body() input: UpdateOrganizationDto,
  ): Promise<OrganizationDto> {
    return this.organizations.update(access, input);
  }

  @Delete('organizations/:organizationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('organization:delete')
  @ApiOperation({ summary: 'Delete an organization and all of its data (owner only)' })
  @ApiNoContentResponse()
  delete(@Access() access: AccessContext): Promise<void> {
    return this.organizations.delete(access);
  }

  @Post('organizations/:organizationId/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave an organization (owners must transfer ownership first)' })
  @ApiNoContentResponse()
  leave(@Access() access: AccessContext): Promise<void> {
    return this.organizations.leave(access);
  }

  @Post('organizations/:organizationId/transfer-ownership')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('organization:delete')
  @ApiOperation({ summary: 'Make another member the owner (the current owner becomes an admin)' })
  @ApiNoContentResponse()
  transferOwnership(
    @Access() access: AccessContext,
    @Body() input: TransferOwnershipDto,
  ): Promise<void> {
    return this.organizations.transferOwnership(access, input.memberId);
  }

  @Post('invitations/accept')
  // Tokens are 256-bit, but there is no reason to allow guessing at speed.
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Accept an invitation sent to the current user’s email address' })
  @ApiCreatedResponse({ type: OrganizationDto })
  accept(
    @CurrentUser() user: AuthUser,
    @Body() input: AcceptInvitationDto,
  ): Promise<OrganizationDto> {
    return this.invitations.acceptByToken(user.id, input.token);
  }
}
