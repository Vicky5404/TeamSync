import { useState } from 'react';

import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/cn';

interface EditableTitleProps {
  value: string;
  onSave: (value: string) => void;
  disabled?: boolean;
}

/** Click-to-edit task title. Enter or blur saves, Escape cancels. */
export function EditableTitle({ value, onSave, disabled = false }: EditableTitleProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const trimmed = draft.trim();
    setDraft(null);
    if (trimmed && trimmed !== value) onSave(trimmed.slice(0, 200));
  };

  if (draft !== null) {
    return (
      <Textarea
        autoFocus
        value={draft}
        rows={1}
        maxLength={200}
        aria-label="Task title"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            event.stopPropagation();
            setDraft(null);
          }
        }}
        className="min-h-0 resize-none px-2 py-1 text-lg font-semibold"
      />
    );
  }

  return (
    <h3>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setDraft(value)}
        className={cn(
          '-mx-2 w-full rounded-md px-2 py-1 text-left text-lg font-semibold text-foreground',
          !disabled && 'hover:bg-accent',
          'disabled:cursor-default',
        )}
        aria-label={disabled ? undefined : `Edit title: ${value}`}
      >
        {value}
      </button>
    </h3>
  );
}
