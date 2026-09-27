import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

export type BadgeVariant =
  'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-muted text-muted-foreground',
  primary: 'bg-primary-soft text-primary-soft-foreground',
  success: 'bg-success-soft text-success-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  danger: 'bg-destructive-soft text-destructive-soft-foreground',
  info: 'bg-info-soft text-info-soft-foreground',
  outline: 'border border-border text-muted-foreground',
};

const DOTS: Record<BadgeVariant, string> = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
  outline: 'bg-muted-foreground',
};

export interface BadgeProps extends ComponentProps<'span'> {
  variant?: BadgeVariant;
  dot?: boolean;
  size?: 'sm' | 'md';
}

export function Badge({
  variant = 'neutral',
  dot = false,
  size = 'sm',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOTS[variant])} />}
      {children}
    </span>
  );
}
