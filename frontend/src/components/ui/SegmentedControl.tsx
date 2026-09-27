import { useRef, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Accessible label when `label` is icon-only. */
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string | number> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onValueChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Compact single-choice control (radio group semantics). */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onValueChange,
  label,
  size = 'sm',
  className,
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (index + delta + options.length) % options.length;
    const next = options[nextIndex];
    if (!next) return;
    onValueChange(next.value);
    groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('inline-flex rounded-lg bg-surface-muted p-0.5', className)}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            tabIndex={checked ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              checked && 'bg-surface text-foreground shadow-xs',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
