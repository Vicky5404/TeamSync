import { toUserSummary, userSummarySelect } from '../../common/dto/user-summary.dto.js';
import { toISODate } from '../../common/utils/dates.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AttachmentStatus } from '../../generated/prisma/enums.js';
import { labelSelect, toLabelDto } from '../labels/labels.service.js';

import type { ChecklistItemDto, TaskDetailDto, TaskDto } from './dto/task.dto.js';

export const taskInclude = {
  project: { select: { id: true, key: true, name: true } },
  assignee: { select: userSummarySelect },
  reporter: { select: userSummarySelect },
  labels: { select: { label: { select: labelSelect } } },
  checklistItems: { select: { completed: true } },
  _count: {
    select: {
      comments: { where: { deletedAt: null } },
      attachments: { where: { status: AttachmentStatus.READY } },
    },
  },
} as const satisfies Prisma.TaskInclude;

export const taskDetailInclude = {
  ...taskInclude,
  checklistItems: {
    select: { id: true, title: true, completed: true, position: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  },
} as const satisfies Prisma.TaskInclude;

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
export type TaskDetailRow = Prisma.TaskGetPayload<{ include: typeof taskDetailInclude }>;

export function taskIdentifier(task: { number: number; project: { key: string } }): string {
  return `${task.project.key}-${task.number}`;
}

export function toTaskDto(task: TaskRow | TaskDetailRow): TaskDto {
  const checklist = task.checklistItems as Array<{ completed: boolean }>;
  return {
    id: task.id,
    identifier: taskIdentifier(task),
    project: { id: task.project.id, key: task.project.key, name: task.project.name },
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    position: task.position,
    assignee: task.assigneeId ? toUserSummary(task.assignee, task.assigneeId) : null,
    reporter: toUserSummary(task.reporter, task.reporterId ?? ''),
    dueDate: toISODate(task.dueDate),
    labels: task.labels
      .map(({ label }) => toLabelDto(label))
      .sort((a, b) => a.name.localeCompare(b.name)),
    commentCount: task._count.comments,
    attachmentCount: task._count.attachments,
    checklist: {
      total: checklist.length,
      completed: checklist.filter((item) => item.completed).length,
    },
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
  };
}

export function toChecklistItemDto(item: {
  id: string;
  title: string;
  completed: boolean;
  position: number;
}): ChecklistItemDto {
  return { id: item.id, title: item.title, completed: item.completed, position: item.position };
}

export function toTaskDetailDto(task: TaskDetailRow): TaskDetailDto {
  return { ...toTaskDto(task), checklistItems: task.checklistItems.map(toChecklistItemDto) };
}
