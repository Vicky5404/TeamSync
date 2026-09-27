import type { ReactNode } from 'react';

import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { formatCompactNumber } from '@/utils/format';

interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: ReactNode;
  /** Secondary line under the value, e.g. "12 due this week". */
  hint?: ReactNode;
  tone?: 'default' | 'danger' | 'success';
  isLoading?: boolean;
  className?: string;
}

const ICON_TONES = {
  default: 'bg-primary-soft text-primary-soft-foreground',
  danger: 'bg-destructive-soft text-destructive-soft-foreground',
  success: 'bg-success-soft text-success-soft-foreground',
} as const;

/** KPI tile: label · value (auto-compact) · optional hint. */
export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = 'default',
  isLoading = false,
  className,
}: StatCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          aria-hidden="true"
          className={cn(
            'flex size-8 items-center justify-center rounded-lg [&_svg]:size-4',
            ICON_TONES[tone],
          )}
        >
          {icon}
        </span>
      </div>
      {isLoading || value === undefined ? (
        <div className="mt-2 space-y-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {formatCompactNumber(value)}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </>
      )}
    </Card>
  );
}
