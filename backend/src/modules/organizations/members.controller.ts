import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AccessContext } from '../../common/auth/auth.types.js';
import { Access, RequirePermission } from '../../common/auth/decorators.js';
import { uuidParam } from '../../common/pipes/uuid-param.pipe.js';

import {
  InvitationDto,
  InviteMembersDto,
  InviteMembersResultDto,
  MemberDto,
  MemberListQueryDto,
  MemberProfileDto,
  UpdateMemberRoleDto,
} from './dto/organization.dto.js';
import { InvitationsService } from './invitations.service.js';
import { MembersService } from './members.service.js';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations/:organizationId')
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly invitations: InvitationsService,
  ) {}

  // Members --------------------------------------------------------------------

  @Get('members')
  @ApiOperation({ summary: 'List members (sorted by role, then name)' })
  @ApiOkResponse({ type: [MemberDto] })
  list(@Access() access: AccessContext, @Query() query: MemberListQueryDto): Promise<MemberDto[]> {
    return this.members.list(access.organizationId, query);
  }

  @Get('members/:memberId')
  @ApiOperation({ summary: 'Member profile with workload stats and projects' })
  @ApiOkResponse({ type: MemberProfileDto })
  profile(
    @Access() access: AccessContext,
    @Param('memberId', uuidParam('Member')) memberId: string,
  ): Promise<MemberProfileDto> {
    return this.members.profile(access.organizationId, memberId);
  }

  @Patch('members/:memberId')
  @RequirePermission('members:manage')
  @ApiOperation({
    summary: 'Change a member’s role (only for lower-ranked members, never to OWNER)',
  })
  @ApiOkResponse({ type: MemberDto })
  updateRole(
    @Access() access: AccessContext,
    @Param('memberId', uuidParam('Member')) memberId: string,
    @Body() input: UpdateMemberRoleDto,
  ): Promise<MemberDto> {
    return this.members.updateRole(access, memberId, input.role);
  }

  @Delete('members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('members:manage')
  @ApiOperation({ summary: 'Remove a member (unassigns their tasks)' })
  @ApiNoContentResponse()
  remove(
    @Access() access: AccessContext,
    @Param('memberId', uuidParam('Member')) memberId: string,
  ): Promise<void> {
    return this.members.remove(access, memberId);
  }

  // Invitations ----------------------------------------------------------------

  @Get('invitations')
  @RequirePermission('members:invite')
  @ApiOperation({ summary: 'Pending and expired invitations' })
  @ApiOkResponse({ type: [InvitationDto] })
  listInvitations(@Access() access: AccessContext): Promise<InvitationDto[]> {
    return this.invitations.list(access.organizationId);
  }

  @Post('invitations')
  @RequirePermission('members:invite')
  @ApiOperation({ summary: 'Invite people by email' })
  @ApiCreatedResponse({ type: InviteMembersResultDto })
  invite(
    @Access() access: AccessContext,
    @Body() input: InviteMembersDto,
  ): Promise<InviteMembersResultDto> {
    return this.invitations.invite(access, input);
  }

  @Post('invitations/:invitationId/resend')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('members:invite')
  @ApiOperation({ summary: 'Resend an invitation with a fresh link' })
  @ApiOkResponse({ type: InvitationDto })
  resend(
    @Access() access: AccessContext,
    @Param('invitationId', uuidParam('Invitation')) invitationId: string,
  ): Promise<InvitationDto> {
    return this.invitations.resend(access, invitationId);
  }

  @Delete('invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('members:invite')
  @ApiOperation({ summary: 'Revoke an invitation' })
  @ApiNoContentResponse()
  revoke(
    @Access() access: AccessContext,
    @Param('invitationId', uuidParam('Invitation')) invitationId: string,
  ): Promise<void> {
    return this.invitations.revoke(access, invitationId);
  }
}
