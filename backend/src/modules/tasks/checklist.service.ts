import { Injectable } from '@nestjs/common';

import type { AccessContext } from '../../common/auth/auth.types.js';
import { Errors } from '../../common/errors/api-exception.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

import type {
  ChecklistItemDto,
  CreateChecklistItemDto,
  UpdateChecklistItemDto,
} from './dto/task.dto.js';
import { toChecklistItemDto } from './task.mapper.js';
import { POSITION_STEP } from './tasks.repository.js';
import { TasksService } from './tasks.service.js';

const MAX_ITEMS_PER_TASK = 200;

@Injectable()
export class ChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
  ) {}

  async add(access: AccessContext, input: CreateChecklistItemDto): Promise<ChecklistItemDto> {
    const taskId = requireTaskId(access);
    const { _max, _count } = await this.prisma.checklistItem.aggregate({
      where: { taskId },
      _max: { position: true },
      _count: { _all: true },
    });
    if (_count._all >= MAX_ITEMS_PER_TASK) throw Errors.field('title', 'This checklist is full');
    const item = await this.prisma.checklistItem.create({
      data: { taskId, title: input.title, position: (_max.position ?? 0) + POSITION_STEP },
    });
    await this.tasks.touch(access, taskId);
    return toChecklistItemDto(item);
  }

  async update(
    access: AccessContext,
    itemId: string,
    input: UpdateChecklistItemDto,
  ): Promise<ChecklistItemDto> {
    const taskId = requireTaskId(access);
    await this.requireItem(taskId, itemId);
    const item = await this.prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.completed !== undefined ? { completed: input.completed } : {}),
      },
    });
    await this.tasks.touch(access, taskId);
    return toChecklistItemDto(item);
  }

  async remove(access: AccessContext, itemId: string): Promise<void> {
    const taskId = requireTaskId(access);
    const { count } = await this.prisma.checklistItem.deleteMany({ where: { id: itemId, taskId } });
    if (count === 0) throw Errors.notFound('Checklist item');
    await this.tasks.touch(access, taskId);
  }

  private async requireItem(taskId: string, itemId: string): Promise<void> {
    const exists = await this.prisma.checklistItem.count({ where: { id: itemId, taskId } });
    if (!exists) throw Errors.notFound('Checklist item');
  }
}

function requireTaskId(access: AccessContext): string {
  if (!access.taskId) throw Errors.notFound('Task');
  return access.taskId;
}
