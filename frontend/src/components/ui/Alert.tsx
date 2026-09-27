import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const STYLES: Record<AlertVariant, string> = {
  info: 'border-info/25 bg-info-soft text-info-soft-foreground',
  success: 'border-success/25 bg-success-soft text-success-soft-foreground',
  warning: 'border-warning/25 bg-warning-soft text-warning-soft-foreground',
  danger: 'border-destructive/25 bg-destructive-soft text-destructive-soft-foreground',
};

const ICONS: Record<AlertVariant, typeof Info> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

interface AlertProps {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Inline, persistent message (form errors, notices). Errors are announced. */
export function Alert({ variant = 'info', title, children, action, className }: AlertProps) {
  const Icon = ICONS[variant];
  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-3.5 py-3 text-sm', STYLES[variant], className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="opacity-90">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
