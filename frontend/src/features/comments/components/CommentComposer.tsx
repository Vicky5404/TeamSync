import { useId, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { Textarea } from '@/components/ui/Textarea';
import { MOD_KEY_LABEL } from '@/hooks/useHotkey';

interface CommentComposerProps {
  onSubmit: (body: string) => void;
  isSubmitting?: boolean;
  initialValue?: string;
  submitLabel?: string;
  onCancel?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}

const MAX_LENGTH = 5000;

export function CommentComposer({
  onSubmit,
  isSubmitting = false,
  initialValue = '',
  submitLabel = 'Comment',
  onCancel,
  autoFocus = false,
  placeholder = 'Write a comment…',
}: CommentComposerProps) {
  const [body, setBody] = useState(initialValue);
  const hintId = useId();
  const trimmed = body.trim();

  const submit = () => {
    if (!trimmed || isSubmitting) return;
    onSubmit(trimmed);
    if (!onCancel) setBody('');
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-2"
    >
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          }
          if (event.key === 'Escape' && onCancel) {
            event.stopPropagation();
            onCancel();
          }
        }}
        placeholder={placeholder}
        aria-label={submitLabel === 'Comment' ? 'Add a comment' : 'Edit comment'}
        aria-describedby={hintId}
        maxLength={MAX_LENGTH}
        autoFocus={autoFocus}
        rows={2}
        className="min-h-16"
      />
      <div className="flex items-center justify-between gap-2">
        <p id={hintId} className="hidden text-xs text-muted-foreground sm:block">
          <Kbd>{MOD_KEY_LABEL}</Kbd> + <Kbd>Enter</Kbd> to submit
        </p>
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!trimmed} loading={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
