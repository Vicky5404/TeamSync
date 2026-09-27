import { Pencil } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

interface DescriptionEditorProps {
  value: string | null;
  onSave: (value: string | null) => void;
  isSaving?: boolean;
  disabled?: boolean;
}

export function DescriptionEditor({
  value,
  onSave,
  isSaving = false,
  disabled = false,
}: DescriptionEditorProps) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft !== null) {
    return (
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = draft.trim();
          onSave(trimmed ? trimmed : null);
          setDraft(null);
        }}
      >
        <Textarea
          autoFocus
          value={draft}
          rows={6}
          maxLength={10_000}
          aria-label="Task description"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setDraft(null);
            }
          }}
          placeholder="Add more detail to this task…"
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={isSaving}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (!value) {
    return disabled ? (
      <p className="text-sm text-muted-foreground">No description.</p>
    ) : (
      <button
        type="button"
        onClick={() => setDraft('')}
        className="w-full rounded-lg border border-dashed border-input px-3 py-4 text-left text-sm text-muted-foreground hover:bg-accent"
      >
        Add a description…
      </button>
    );
  }

  return (
    <div className="group relative">
      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
        {value}
      </p>
      {!disabled && (
        <Button
          variant="outline"
          size="xs"
          onClick={() => setDraft(value)}
          leftIcon={<Pencil />}
          className="mt-2"
        >
          Edit description
        </Button>
      )}
    </div>
  );
}
