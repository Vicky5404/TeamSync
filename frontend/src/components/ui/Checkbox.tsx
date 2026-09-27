import { useId, type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
}

export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;

  const input = (
    <input
      id={inputId}
      type="checkbox"
      aria-describedby={descriptionId}
      className={cn(
        'size-4 shrink-0 cursor-pointer rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );

  if (!label) return input;

  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-5 items-center">{input}</span>
      <span className="flex flex-col">
        <label htmlFor={inputId} className="cursor-pointer text-sm leading-5 text-foreground">
          {label}
        </label>
        {description && (
          <span id={descriptionId} className="text-xs text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </div>
  );
}
