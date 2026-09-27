import { useId, useMemo, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { FormFieldContext } from './form-field-context';
import { Label } from './Label';

interface FormFieldProps {
  label?: ReactNode;
  /** Visually hide the label while keeping it accessible. */
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  id?: string;
  /** Element rendered on the right of the label row (e.g. "Forgot password?"). */
  labelAction?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Labelled wrapper for a single form control. Controls inside (Input, Select,
 * Textarea) automatically receive the id, aria-invalid and aria-describedby.
 */
export function FormField({
  label,
  hideLabel,
  hint,
  error,
  required = false,
  id,
  labelAction,
  className,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  const context = useMemo(
    () => ({
      id: fieldId,
      describedBy: error ? errorId : hint ? hintId : undefined,
      invalid: Boolean(error),
      required,
    }),
    [fieldId, error, hint, errorId, hintId, required],
  );

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <div className={cn('flex items-center justify-between gap-2', hideLabel && 'sr-only')}>
          <Label htmlFor={fieldId} required={required}>
            {label}
          </Label>
          {labelAction}
        </div>
      )}
      <FormFieldContext.Provider value={context}>{children}</FormFieldContext.Provider>
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
