import type { Task, TaskStatus, UserSummary } from '@/types';

export const alex: UserSummary = {
  id: '0190f0a0-0000-7000-8000-00000000a001',
  name: 'Alex Morgan',
  email: 'alex@example.com',
  avatarUrl: null,
};

export const sam: UserSummary = {
  id: '0190f0a0-0000-7000-8000-00000000a002',
  name: 'Sam Lee',
  email: 'sam@example.com',
  avatarUrl: null,
};

let sequence = 0;

/** A task as returned by the API, with sensible defaults. */
export function makeTask(overrides: Partial<Task> & { status?: TaskStatus } = {}): Task {
  sequence += 1;
  return {
    id: `0190f0a0-0000-7000-8000-${String(sequence).padStart(12, '0')}`,
    identifier: `WEB-${sequence}`,
    project: { id: 'project-1', key: 'WEB', name: 'Website' },
    title: `Task ${sequence}`,
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    position: sequence * 1024,
    assignee: null,
    reporter: alex,
    dueDate: null,
    labels: [],
    commentCount: 0,
    attachmentCount: 0,
    checklist: { total: 0, completed: 0 },
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}
