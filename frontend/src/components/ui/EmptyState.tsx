import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'md' ? 'gap-3 px-6 py-14' : 'gap-2 px-4 py-8',
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden="true"
          className={cn(
            'flex items-center justify-center rounded-full bg-surface-muted text-muted-foreground',
            size === 'md' ? 'size-12 [&_svg]:size-6' : 'size-9 [&_svg]:size-4',
          )}
        >
          {icon}
        </div>
      )}
      <div className="max-w-sm space-y-1">
        <h3
          className={cn('font-semibold text-foreground', size === 'md' ? 'text-base' : 'text-sm')}
        >
          {title}
        </h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
