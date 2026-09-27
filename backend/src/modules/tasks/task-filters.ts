import { addDays, endOfWeekUTC, fromISODate, startOfTodayUTC } from '../../common/utils/dates.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { TaskStatus } from '../../generated/prisma/enums.js';

import type { TaskFiltersDto, TaskSortField } from './dto/task.dto.js';

const IDENTIFIER = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d{1,9})$/;

/**
 * Translate list filters into a Prisma `where`. Each filter becomes one AND
 * clause so OR-based filters (search, assignee) can't interfere.
 */
export function buildTaskWhere(
  filters: TaskFiltersDto,
  userId: string,
  now = new Date(),
): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [];
  const today = startOfTodayUTC(now);

  const search = filters.search?.trim();
  if (search) {
    const or: Prisma.TaskWhereInput[] = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
    const identifier = IDENTIFIER.exec(search);
    if (identifier?.[1] && identifier[2]) {
      or.push({ number: Number(identifier[2]), project: { key: identifier[1].toUpperCase() } });
    } else if (/^\d{1,9}$/.test(search)) {
      or.push({ number: Number(search) });
    }
    and.push({ OR: or });
  }

  if (filters.status?.length) and.push({ status: { in: filters.status } });
  if (filters.priority?.length) and.push({ priority: { in: filters.priority } });

  if (filters.assignee?.length) {
    and.push({
      OR: filters.assignee.map((assignee): Prisma.TaskWhereInput => {
        if (assignee === 'me') return { assigneeId: userId };
        if (assignee === 'unassigned') return { assigneeId: null };
        return { assigneeId: assignee };
      }),
    });
  }

  if (filters.labels?.length) and.push({ labels: { some: { labelId: { in: filters.labels } } } });

  switch (filters.due) {
    case 'overdue':
      and.push({ status: { not: TaskStatus.DONE }, dueDate: { lt: today } });
      break;
    case 'today':
      and.push({ dueDate: today });
      break;
    case 'this_week':
      and.push({ dueDate: { gte: today, lte: endOfWeekUTC(now) } });
      break;
    case 'next_7_days':
      and.push({ dueDate: { gte: today, lte: addDays(today, 7) } });
      break;
    case 'no_date':
      and.push({ dueDate: null });
      break;
  }
  if (filters.dueFrom) and.push({ dueDate: { gte: fromISODate(filters.dueFrom) } });
  if (filters.dueTo) and.push({ dueDate: { lte: fromISODate(filters.dueTo) } });

  return and.length > 0 ? { AND: and } : {};
}

/** Stable ordering for the organization-wide list; nulls always sort last. */
export function buildTaskOrderBy(
  sort: TaskSortField = 'updatedAt',
  order: 'asc' | 'desc' = 'desc',
): Prisma.TaskOrderByWithRelationInput[] {
  const tieBreaker: Prisma.TaskOrderByWithRelationInput = { id: order };
  switch (sort) {
    case 'dueDate':
      return [{ dueDate: { sort: order, nulls: 'last' } }, tieBreaker];
    case 'title':
      return [{ title: order }, tieBreaker];
    // Enums sort by declaration order (BACKLOG → DONE, LOW → URGENT).
    case 'status':
      return [{ status: order }, { position: 'asc' }, tieBreaker];
    case 'priority':
      return [{ priority: order }, tieBreaker];
    case 'createdAt':
      return [{ createdAt: order }, tieBreaker];
    default:
      return [{ updatedAt: order }, tieBreaker];
  }
}
