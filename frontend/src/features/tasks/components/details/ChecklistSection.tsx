import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { cn } from '@/lib/cn';
import type { ChecklistItem } from '@/types';

import {
  useAddChecklistItem,
  useDeleteChecklistItem,
  useUpdateChecklistItem,
} from '../../api/tasks.queries';

interface ChecklistSectionProps {
  taskId: string;
  items: readonly ChecklistItem[];
  canEdit: boolean;
}

export function ChecklistSection({ taskId, items, canEdit }: ChecklistSectionProps) {
  const [title, setTitle] = useState('');
  const add = useAddChecklistItem(taskId);
  const update = useUpdateChecklistItem(taskId);
  const remove = useDeleteChecklistItem(taskId);
  const completed = items.filter((item) => item.completed).length;
  const sorted = [...items].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <ProgressBar
            value={completed}
            max={items.length}
            label="Checklist progress"
            tone={completed === items.length ? 'success' : 'primary'}
          />
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {completed}/{items.length}
          </span>
        </div>
      )}

      {sorted.length > 0 && (
        <ul className="space-y-1">
          {sorted.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-accent/60"
            >
              <input
                id={`checklist-${item.id}`}
                type="checkbox"
                checked={item.completed}
                disabled={!canEdit}
                onChange={(event) =>
                  update.mutate({ itemId: item.id, completed: event.target.checked })
                }
                className="size-4 shrink-0 cursor-pointer rounded accent-primary disabled:cursor-default"
              />
              <label
                htmlFor={`checklist-${item.id}`}
                className={cn(
                  'flex-1 cursor-pointer text-sm',
                  item.completed && 'text-muted-foreground line-through',
                )}
              >
                {item.title}
              </label>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete checklist item: ${item.title}`}
                  onClick={() => remove.mutate(item.id)}
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = title.trim();
            if (!trimmed) return;
            add.mutate(trimmed, { onSuccess: () => setTitle('') });
          }}
        >
          <Input
            size="sm"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add an item"
            aria-label="New checklist item"
            maxLength={200}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            loading={add.isPending}
            disabled={!title.trim()}
            leftIcon={<Plus />}
          >
            Add
          </Button>
        </form>
      )}

      {!canEdit && items.length === 0 && (
        <p className="text-sm text-muted-foreground">No checklist items.</p>
      )}
    </div>
  );
}
