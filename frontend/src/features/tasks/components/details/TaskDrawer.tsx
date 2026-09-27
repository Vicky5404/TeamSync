import { EllipsisVertical, Link2, Trash } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Drawer } from '@/components/ui/Drawer';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { ActivityFeed } from '@/features/activity/components/ActivityFeed';
import { CommentsSection } from '@/features/comments/components/CommentsSection';
import { usePermissions } from '@/features/organizations/active-organization';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { ApiError } from '@/lib/http';
import { paths } from '@/routes/paths';
import { toast } from '@/store/toast.store';
import type { TaskDetail } from '@/types';

import { useDeleteTask, useTask, useTaskActivity, useUpdateTask } from '../../api/tasks.queries';
import { AttachmentsSection } from './AttachmentsSection';
import { ChecklistSection } from './ChecklistSection';
import { DescriptionEditor } from './DescriptionEditor';
import { EditableTitle } from './EditableTitle';
import { TaskProperties } from './TaskProperties';

interface TaskDrawerProps {
  taskId: string | null;
  onClose: () => void;
}

/** Task details side panel. Opened via the `?task=<id>` URL param. */
export function TaskDrawer({ taskId, onClose }: TaskDrawerProps) {
  const task = useTask(taskId);

  return (
    <Drawer
      open={Boolean(taskId)}
      onClose={onClose}
      size="lg"
      title={task.data ? `${task.data.identifier}: ${task.data.title}` : 'Task details'}
      header={
        task.data ? (
          <TaskDrawerHeader task={task.data} onDeleted={onClose} />
        ) : (
          <Skeleton className="h-5 w-40" />
        )
      }
    >
      {task.isPending ? (
        <TaskDetailsSkeleton />
      ) : task.isError ? (
        <ErrorState
          error={task.error}
          title={
            task.error instanceof ApiError && task.error.isNotFound
              ? 'Task not found'
              : "Couldn't load this task"
          }
          message={
            task.error instanceof ApiError && task.error.isNotFound
              ? 'It may have been deleted or moved to a project you cannot access.'
              : undefined
          }
          onRetry={
            task.error instanceof ApiError && task.error.isNotFound
              ? undefined
              : () => void task.refetch()
          }
          retrying={task.isFetching}
        />
      ) : (
        <TaskDetails task={task.data} />
      )}
    </Drawer>
  );
}

function TaskDrawerHeader({ task, onDeleted }: { task: TaskDetail; onDeleted: () => void }) {
  const { can } = usePermissions();
  const copy = useCopyToClipboard();
  const deleteTask = useDeleteTask();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <nav aria-label="Task location" className="min-w-0 flex-1 truncate text-sm">
        <Link
          to={paths.projectBoard(task.project.id)}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          {task.project.name}
        </Link>
        <span aria-hidden="true" className="mx-1.5 text-muted-foreground">
          /
        </span>
        <span className="font-medium text-foreground">{task.identifier}</span>
      </nav>
      <Dropdown
        label="Task actions"
        trigger={(props) => (
          <Button {...props} variant="ghost" size="icon-sm" aria-label="Task actions">
            <EllipsisVertical />
          </Button>
        )}
      >
        <DropdownItem
          icon={<Link2 />}
          onSelect={() =>
            void copy(
              `${window.location.origin}${paths.task(task.project.id, task.id)}`,
              'Task link copied',
            )
          }
        >
          Copy link
        </DropdownItem>
        {can('tasks:delete') && (
          <DropdownItem icon={<Trash />} destructive onSelect={() => setConfirmDelete(true)}>
            Delete task
          </DropdownItem>
        )}
      </Dropdown>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${task.identifier}?`}
        description="The task, its checklist, comments and attachments will be permanently deleted."
        confirmLabel="Delete task"
        loading={deleteTask.isPending}
        onConfirm={() =>
          deleteTask.mutate(
            { taskId: task.id, projectId: task.project.id },
            {
              onSuccess: () => {
                toast.success(`${task.identifier} deleted`);
                setConfirmDelete(false);
                onDeleted();
              },
            },
          )
        }
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

type DetailTab = 'comments' | 'activity';

function TaskDetails({ task }: { task: TaskDetail }) {
  const { can } = usePermissions();
  const canEdit = can('tasks:update');
  const updateTask = useUpdateTask();
  const [tab, setTab] = useState<DetailTab>('comments');
  const tabsId = `task-${task.id}-tabs`;

  return (
    <div className="space-y-7 px-4 py-5 sm:px-6">
      <div className="space-y-4">
        <EditableTitle
          value={task.title}
          disabled={!canEdit}
          onSave={(title) => updateTask.mutate({ taskId: task.id, input: { title } })}
        />
        <TaskProperties task={task} canEdit={canEdit} />
      </div>

      <Section title="Description">
        <DescriptionEditor
          value={task.description}
          disabled={!canEdit}
          isSaving={updateTask.isPending}
          onSave={(description) => updateTask.mutate({ taskId: task.id, input: { description } })}
        />
      </Section>

      <Section title="Checklist">
        <ChecklistSection taskId={task.id} items={task.checklistItems} canEdit={canEdit} />
      </Section>

      <Section title={`Attachments${task.attachmentCount ? ` (${task.attachmentCount})` : ''}`}>
        <AttachmentsSection taskId={task.id} canEdit={canEdit} />
      </Section>

      <div className="space-y-4">
        <Tabs
          idBase={tabsId}
          label="Task discussion"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'comments', label: 'Comments', count: task.commentCount },
            { value: 'activity', label: 'Activity' },
          ]}
        />
        <TabPanel idBase={tabsId} value={tab}>
          {tab === 'comments' ? (
            <CommentsSection taskId={task.id} />
          ) : (
            <TaskActivity taskId={task.id} />
          )}
        </TabPanel>
      </div>
    </div>
  );
}

function TaskActivity({ taskId }: { taskId: string }) {
  const activity = useTaskActivity(taskId);
  return (
    <ActivityFeed
      items={activity.data}
      isLoading={activity.isPending}
      error={activity.error}
      onRetry={() => void activity.refetch()}
      showTarget={false}
      emptyMessage="Changes to this task will appear here."
    />
  );
}

function TaskDetailsSkeleton() {
  return (
    <SkeletonGroup label="Loading task" className="space-y-6 px-4 py-5 sm:px-6">
      <Skeleton className="h-7 w-3/4" />
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="grid grid-cols-[8rem_1fr] gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
    </SkeletonGroup>
  );
}
