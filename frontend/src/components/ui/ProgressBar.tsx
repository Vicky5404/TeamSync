import { cn } from '@/lib/cn';

interface ProgressBarProps {
  value: number;
  max?: number;
  label: string;
  size?: 'sm' | 'md';
  /** Color follows the value's meaning; defaults to neutral progress. */
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

const TONES = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
} as const;

export function ProgressBar({
  value,
  max = 100,
  label,
  size = 'sm',
  tone = 'primary',
  className,
}: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={cn(
        'w-full overflow-hidden rounded-full bg-surface-muted',
        size === 'sm' ? 'h-1.5' : 'h-2.5',
        className,
      )}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', TONES[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
