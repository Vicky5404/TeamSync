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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AccessContext } from '../../common/auth/auth.types.js';
import { Access, AllowDeleted, RequirePermission } from '../../common/auth/decorators.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { uuidParam } from '../../common/pipes/uuid-param.pipe.js';
import type { Paginated } from '../../common/utils/pagination.js';

import {
  AddProjectMemberDto,
  CreateProjectDto,
  PaginatedProjectsDto,
  ProjectDto,
  ProjectListQueryDto,
  UpdateProjectDto,
} from './dto/project.dto.js';
import { ProjectsService } from './projects.service.js';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('organizations/:organizationId/projects')
  @ApiOperation({ summary: 'List projects (search, status filter, sorting, pagination)' })
  @ApiOkResponse({ type: PaginatedProjectsDto })
  list(
    @Access() access: AccessContext,
    @Query() query: ProjectListQueryDto,
  ): Promise<Paginated<ProjectDto>> {
    return this.projects.list(access.organizationId, query);
  }

  @Post('organizations/:organizationId/projects')
  @RequirePermission('projects:create')
  @ApiOperation({ summary: 'Create a project (the creator is added as a member)' })
  @ApiCreatedResponse({ type: ProjectDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Project key already in use' })
  create(@Access() access: AccessContext, @Body() input: CreateProjectDto): Promise<ProjectDto> {
    return this.projects.create(access, input);
  }

  @Get('projects/:projectId')
  @ApiOperation({ summary: 'Get a project' })
  @ApiOkResponse({ type: ProjectDto })
  get(@Access() access: AccessContext): Promise<ProjectDto> {
    return this.projects.get(access);
  }

  @Patch('projects/:projectId')
  @RequirePermission('projects:update')
  @ApiOperation({ summary: 'Update a project (`memberIds` replaces the member list)' })
  @ApiOkResponse({ type: ProjectDto })
  update(@Access() access: AccessContext, @Body() input: UpdateProjectDto): Promise<ProjectDto> {
    return this.projects.update(access, input);
  }

  @Delete('projects/:projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('projects:delete')
  @ApiOperation({
    summary:
      'Move a project and its tasks to the trash (restorable for 30 days, then purged with its files)',
  })
  @ApiNoContentResponse()
  delete(@Access() access: AccessContext): Promise<void> {
    return this.projects.delete(access);
  }

  @Post('projects/:projectId/restore')
  @HttpCode(HttpStatus.OK)
  @AllowDeleted()
  @RequirePermission('projects:delete')
  @ApiOperation({ summary: 'Restore a project (and the tasks trashed with it) from the trash' })
  @ApiOkResponse({ type: ProjectDto })
  @ApiConflictResponse({
    description: 'Another live project now uses this project’s key.',
    type: ApiErrorDto,
  })
  restore(@Access() access: AccessContext): Promise<ProjectDto> {
    return this.projects.restore(access);
  }

  @Post('projects/:projectId/members')
  @RequirePermission('projects:update')
  @ApiOperation({ summary: 'Add an organization member to the project' })
  @ApiCreatedResponse({ type: ProjectDto })
  addMember(
    @Access() access: AccessContext,
    @Body() input: AddProjectMemberDto,
  ): Promise<ProjectDto> {
    return this.projects.addMember(access, input.userId);
  }

  @Delete('projects/:projectId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('projects:update')
  @ApiOperation({ summary: 'Remove a member from the project' })
  @ApiNoContentResponse()
  removeMember(
    @Access() access: AccessContext,
    @Param('userId', uuidParam('Project member')) userId: string,
  ): Promise<void> {
    return this.projects.removeMember(access, userId);
  }
}
