import type { ReactNode } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { useLabels } from '@/features/organizations/api/organizations.queries';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { useProject } from '@/features/projects/api/projects.queries';
import type { Label, TaskDetail, UpdateTaskInput, UserSummary } from '@/types';
import { formatDateTime, isOverdue } from '@/utils/date';

import { useUpdateTask } from '../../api/tasks.queries';
import { AssigneePicker, LabelPicker, PriorityPicker, StatusPicker } from '../TaskFieldPickers';

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-2 sm:grid-cols-[8rem_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

interface TaskPropertiesProps {
  task: TaskDetail;
  canEdit: boolean;
}

/** Editable task metadata; each change is saved immediately with optimistic UI. */
export function TaskProperties({ task, canEdit }: TaskPropertiesProps) {
  const organization = useActiveOrganization();
  const project = useProject(task.project.id);
  const labels = useLabels(organization.id);
  const updateTask = useUpdateTask();

  // Failures roll back optimistically-applied values; the global handler shows a toast.
  const save = (
    input: UpdateTaskInput,
    optimistic?: { assignee?: UserSummary | null; labels?: Label[] },
  ) => updateTask.mutate({ taskId: task.id, input, optimistic });

  const people = project.data?.members ?? (task.assignee ? [task.assignee] : []);
  const overdue = isOverdue(task.dueDate, task.status === 'DONE');

  return (
    <dl className="space-y-1.5">
      <Property label="Status">
        <StatusPicker
          label="Status"
          value={task.status}
          disabled={!canEdit}
          onChange={(status) => save({ status })}
        />
      </Property>
      <Property label="Priority">
        <PriorityPicker
          label="Priority"
          value={task.priority}
          disabled={!canEdit}
          onChange={(priority) => save({ priority })}
        />
      </Property>
      <Property label="Assignee">
        <AssigneePicker
          label="Assignee"
          value={task.assignee}
          people={people}
          disabled={!canEdit}
          onChange={(assignee) => save({ assigneeId: assignee?.id ?? null }, { assignee })}
        />
      </Property>
      <Property label="Due date">
        <div className="flex items-center gap-2 px-2">
          <Input
            type="date"
            size="sm"
            aria-label="Due date"
            value={task.dueDate ?? ''}
            disabled={!canEdit}
            onChange={(event) => save({ dueDate: event.target.value || null })}
            className="w-40"
          />
          {overdue && <span className="text-xs font-medium text-destructive">Overdue</span>}
        </div>
      </Property>
      <Property label="Labels">
        <LabelPicker
          label="Labels"
          value={task.labels}
          options={labels.data ?? []}
          disabled={!canEdit}
          onChange={(selected) =>
            save({ labelIds: selected.map((item) => item.id) }, { labels: selected })
          }
        />
      </Property>
      <Property label="Reporter">
        <span className="flex items-center gap-2 px-2 text-sm">
          <Avatar name={task.reporter.name} src={task.reporter.avatarUrl} size="xs" decorative />
          {task.reporter.name}
        </span>
      </Property>
      <Property label="Created">
        <span className="px-2 text-sm text-muted-foreground">{formatDateTime(task.createdAt)}</span>
      </Property>
      <Property label="Updated">
        <span className="px-2 text-sm text-muted-foreground">{formatDateTime(task.updatedAt)}</span>
      </Property>
    </dl>
  );
}
