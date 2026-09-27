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
import { Access, AllowDeleted, RequirePermission } from '../../common/auth/decorators.js';
import { uuidParam } from '../../common/pipes/uuid-param.pipe.js';
import type { Paginated } from '../../common/utils/pagination.js';

import { ChecklistService } from './checklist.service.js';
import {
  AddLabelsDto,
  AssignTaskDto,
  ChangePriorityDto,
  ChangeStatusDto,
  ChecklistItemDto,
  CreateChecklistItemDto,
  CreateTaskDto,
  MoveTaskDto,
  OrganizationTaskQueryDto,
  PaginatedTasksDto,
  SetDueDateDto,
  TaskDetailDto,
  TaskDto,
  TaskFiltersDto,
  UpdateChecklistItemDto,
  UpdateTaskDto,
} from './dto/task.dto.js';
import { TasksService } from './tasks.service.js';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly checklist: ChecklistService,
  ) {}

  // Lists & search ---------------------------------------------------------------

  @Get('projects/:projectId/tasks')
  @ApiOperation({
    summary: 'All tasks of a project matching the filters (board and list views)',
    description:
      'Ordered by status column, then position. Use the organization task list for paginated search.',
  })
  @ApiOkResponse({ type: [TaskDto] })
  listForProject(
    @Access() access: AccessContext,
    @Query() filters: TaskFiltersDto,
  ): Promise<TaskDto[]> {
    return this.tasks.listForProject(access, filters);
  }

  @Get('organizations/:organizationId/tasks')
  @ApiOperation({ summary: 'Search, filter, sort and paginate tasks across the organization' })
  @ApiOkResponse({ type: PaginatedTasksDto })
  listForOrganization(
    @Access() access: AccessContext,
    @Query() query: OrganizationTaskQueryDto,
  ): Promise<Paginated<TaskDto>> {
    return this.tasks.listForOrganization(access, query);
  }

  // CRUD -------------------------------------------------------------------------

  @Post('projects/:projectId/tasks')
  @RequirePermission('tasks:create')
  @ApiOperation({ summary: 'Create a task (appended to the end of its status column)' })
  @ApiCreatedResponse({ type: TaskDto })
  create(@Access() access: AccessContext, @Body() input: CreateTaskDto): Promise<TaskDto> {
    return this.tasks.create(access, input);
  }

  @Get('tasks/:taskId')
  @ApiOperation({ summary: 'Get a task with its checklist' })
  @ApiOkResponse({ type: TaskDetailDto })
  get(@Access() access: AccessContext): Promise<TaskDetailDto> {
    return this.tasks.get(access);
  }

  @Patch('tasks/:taskId')
  @RequirePermission('tasks:update')
  @ApiOperation({
    summary:
      'Update any task fields (title, description, status, priority, assignee, due date, labels)',
  })
  @ApiOkResponse({ type: TaskDetailDto })
  update(@Access() access: AccessContext, @Body() input: UpdateTaskDto): Promise<TaskDetailDto> {
    return this.tasks.update(access, input);
  }

  @Delete('tasks/:taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('tasks:delete')
  @ApiOperation({
    summary: 'Move a task to the trash (restorable for 30 days, then purged with its files)',
  })
  @ApiNoContentResponse()
  delete(@Access() access: AccessContext): Promise<void> {
    return this.tasks.delete(access);
  }

  @Post('tasks/:taskId/restore')
  @HttpCode(HttpStatus.OK)
  @AllowDeleted()
  @RequirePermission('tasks:delete')
  @ApiOperation({ summary: 'Restore a task from the trash (appended to the end of its column)' })
  @ApiOkResponse({ type: TaskDto })
  restore(@Access() access: AccessContext): Promise<TaskDto> {
    return this.tasks.restore(access);
  }

  // Focused operations ---------------------------------------------------------

  @Post('tasks/:taskId/move')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('tasks:update')
  @ApiOperation({ summary: 'Move a task between/within columns (Kanban drag & drop)' })
  @ApiOkResponse({ type: TaskDto })
  move(@Access() access: AccessContext, @Body() input: MoveTaskDto): Promise<TaskDto> {
    return this.tasks.move(access, input);
  }

  @Patch('tasks/:taskId/assignee')
  @RequirePermission('tasks:update')
  @ApiOperation({ summary: 'Assign or unassign a task' })
  @ApiOkResponse({ type: TaskDetailDto })
  assign(@Access() access: AccessContext, @Body() input: AssignTaskDto): Promise<TaskDetailDto> {
    return this.tasks.update(access, { assigneeId: input.assigneeId });
  }

  @Patch('tasks/:taskId/status')
  @RequirePermission('tasks:update')
  @ApiOperation({ summary: 'Change task status' })
  @ApiOkResponse({ type: TaskDetailDto })
  changeStatus(
    @Access() access: AccessContext,
    @Body() input: ChangeStatusDto,
  ): Promise<TaskDetailDto> {
    return this.tasks.update(access, { status: input.status });
  }

  @Patch('tasks/:taskId/priority')
  @RequirePermission('tasks:update')
  @ApiOperation({ summary: 'Change task priority' })
  @ApiOkResponse({ type: TaskDetailDto })
  changePriority(
    @Access() access: AccessContext,
    @Body() input: ChangePriorityDto,
  ): Promise<TaskDetailDto> {
    return this.tasks.update(access, { priority: input.priority });
  }

  @Patch('tasks/:taskId/due-date')
  @RequirePermission('tasks:update')
  @ApiOperation({ summary: 'Set or clear the due date' })
  @ApiOkResponse({ type: TaskDetailDto })
  setDueDate(
    @Access() access: AccessContext,
    @Body() input: SetDueDateDto,
  ): Promise<TaskDetailDto> {
    return this.tasks.update(access, { dueDate: input.dueDate });
  }

  @Post('tasks/:taskId/labels')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('tasks:update')
  @ApiOperation({ summary: 'Add labels to a task' })
  @ApiOkResponse({ type: TaskDetailDto })
  addLabels(@Access() access: AccessContext, @Body() input: AddLabelsDto): Promise<TaskDetailDto> {
    return this.tasks.addLabels(access, input.labelIds);
  }

  @Delete('tasks/:taskId/labels/:labelId')
  @RequirePermission('tasks:update')
  @ApiOperation({ summary: 'Remove a label from a task' })
  @ApiOkResponse({ type: TaskDetailDto })
  removeLabel(
    @Access() access: AccessContext,
    @Param('labelId', uuidParam('Label')) labelId: string,
  ): Promise<TaskDetailDto> {
    return this.tasks.removeLabel(access, labelId);
  }

  // Checklist ---------------------------------------------------------------------

  @Post('tasks/:taskId/checklist')
  @RequirePermission('tasks:update')
  @ApiOperation({ summary: 'Add a checklist item' })
  @ApiCreatedResponse({ type: ChecklistItemDto })
  addChecklistItem(
    @Access() access: AccessContext,
    @Body() input: CreateChecklistItemDto,
  ): Promise<ChecklistItemDto> {
    return this.checklist.add(access, input);
  }

  @Patch('tasks/:taskId/checklist/:itemId')
  @RequirePermission('tasks:update')
  @ApiOperation({ summary: 'Rename or toggle a checklist item' })
  @ApiOkResponse({ type: ChecklistItemDto })
  updateChecklistItem(
    @Access() access: AccessContext,
    @Param('itemId', uuidParam('Checklist item')) itemId: string,
    @Body() input: UpdateChecklistItemDto,
  ): Promise<ChecklistItemDto> {
    return this.checklist.update(access, itemId, input);
  }

  @Delete('tasks/:taskId/checklist/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('tasks:update')
  @ApiOperation({ summary: 'Delete a checklist item' })
  @ApiNoContentResponse()
  deleteChecklistItem(
    @Access() access: AccessContext,
    @Param('itemId', uuidParam('Checklist item')) itemId: string,
  ): Promise<void> {
    return this.checklist.remove(access, itemId);
  }
}
