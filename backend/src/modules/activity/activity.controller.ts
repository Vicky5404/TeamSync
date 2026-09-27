import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AccessContext } from '../../common/auth/auth.types.js';
import { Access } from '../../common/auth/decorators.js';
import { CursorQueryDto } from '../../common/dto/pagination.dto.js';
import { Errors } from '../../common/errors/api-exception.js';
import type { CursorPage } from '../../common/utils/pagination.js';

import { ActivityService } from './activity.service.js';
import { ActivityDto, ActivityPageDto, ActivityQueryDto } from './dto/activity.dto.js';

/** Activity feeds. Organization membership is enforced by `AccessGuard` from the route params. */
@ApiTags('Activity')
@ApiBearerAuth()
@Controller()
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('organizations/:organizationId/activity')
  @ApiOperation({ summary: 'Organization activity feed (newest first, cursor-paginated)' })
  @ApiOkResponse({ type: ActivityPageDto })
  organizationFeed(
    @Access() access: AccessContext,
    @Query() query: ActivityQueryDto,
  ): Promise<CursorPage<ActivityDto>> {
    return this.activity.listForOrganization(access.organizationId, query);
  }

  @Get('projects/:projectId/activity')
  @ApiOperation({ summary: 'Project activity feed (newest first, cursor-paginated)' })
  @ApiOkResponse({ type: ActivityPageDto })
  projectFeed(
    @Access() access: AccessContext,
    @Query() query: CursorQueryDto,
  ): Promise<CursorPage<ActivityDto>> {
    return this.activity.listForProject(requireProject(access), query);
  }

  @Get('tasks/:taskId/activity')
  @ApiOperation({ summary: 'Task history (latest 50 entries)' })
  @ApiOkResponse({ type: [ActivityDto] })
  taskFeed(@Access() access: AccessContext): Promise<ActivityDto[]> {
    if (!access.taskId) throw Errors.notFound('Task');
    return this.activity.listForTask(access.taskId);
  }
}

function requireProject(access: AccessContext): string {
  if (!access.projectId) throw Errors.notFound('Project');
  return access.projectId;
}
