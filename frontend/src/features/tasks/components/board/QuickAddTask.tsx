import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/http';
import { toast } from '@/store/toast.store';
import type { TaskStatus } from '@/types';

import { useCreateTask } from '../../api/tasks.queries';
import { TASK_STATUS_META } from '../../constants';

interface QuickAddTaskProps {
  projectId: string;
  status: TaskStatus;
}

/** Inline "add a task" at the bottom of a Kanban column. */
export function QuickAddTask({ projectId, status }: QuickAddTaskProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const create = useCreateTask(projectId);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setOpen(false);
      return;
    }
    create.mutate(
      {
        title: trimmed,
        description: null,
        status,
        priority: 'MEDIUM',
        assigneeId: null,
        dueDate: null,
        labelIds: [],
      },
      {
        onSuccess: (task) => {
          setTitle('');
          toast.success(`${task.identifier} created`);
        },
        onError: (error) =>
          toast.error('Could not create task', { description: getErrorMessage(error) }),
      },
    );
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        leftIcon={<Plus />}
        onClick={() => setOpen(true)}
      >
        Add task
      </Button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-2"
    >
      <Input
        autoFocus
        size="sm"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setTitle('');
            setOpen(false);
          }
        }}
        placeholder="Task title"
        aria-label={`New task title in ${TASK_STATUS_META[status].label}`}
        disabled={create.isPending}
        maxLength={200}
      />
      <div className="flex gap-2">
        <Button type="submit" size="xs" loading={create.isPending}>
          Add
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            setTitle('');
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
