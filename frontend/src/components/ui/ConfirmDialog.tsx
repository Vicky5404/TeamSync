import { useId, useRef, useState, type ReactNode, type RefObject } from 'react';

import { Button } from './Button';
import { FormField } from './FormField';
import { Input } from './Input';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  /** When set, the user must type this text to enable the confirm button. */
  confirmationText?: string;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  loading = false,
  variant = 'danger',
  ...props
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const typeToConfirm = Boolean(props.confirmationText);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      preventClose={loading}
      // Destructive actions focus "Cancel" first; type-to-confirm focuses the input.
      initialFocusRef={typeToConfirm ? undefined : variant === 'danger' ? cancelRef : confirmRef}
    >
      <ConfirmDialogBody
        {...props}
        onClose={onClose}
        loading={loading}
        variant={variant}
        cancelRef={cancelRef}
        confirmRef={confirmRef}
      />
    </Modal>
  );
}

function ConfirmDialogBody({
  onClose,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant,
  loading,
  confirmationText,
  children,
  cancelRef,
  confirmRef,
}: Omit<ConfirmDialogProps, 'open' | 'title' | 'description'> & {
  cancelRef: RefObject<HTMLButtonElement | null>;
  confirmRef: RefObject<HTMLButtonElement | null>;
}) {
  const [typed, setTyped] = useState('');
  const inputId = useId();
  const matches = !confirmationText || typed.trim() === confirmationText;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (matches && !loading) onConfirm();
      }}
      className="space-y-4"
    >
      {children}
      {confirmationText && (
        <FormField
          id={inputId}
          label={
            <>
              Type <span className="font-semibold">{confirmationText}</span> to confirm
            </>
          }
        >
          <Input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </FormField>
      )}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button ref={cancelRef} variant="outline" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          ref={confirmRef}
          type="submit"
          variant={variant === 'danger' ? 'destructive' : 'primary'}
          loading={loading}
          disabled={!matches}
        >
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}
