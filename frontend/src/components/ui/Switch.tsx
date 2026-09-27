import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

interface SwitchProps extends Omit<ComponentProps<'button'>, 'onChange' | 'role'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
}

export function Switch({
  checked,
  onCheckedChange,
  size = 'md',
  className,
  disabled,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input',
        size === 'sm' ? 'h-4 w-7' : 'h-5 w-9',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none block rounded-full bg-white shadow-sm transition-transform',
          size === 'sm' ? 'size-3' : 'size-4',
          checked ? (size === 'sm' ? 'translate-x-3.5' : 'translate-x-4.5') : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
