import { RefreshCw, TriangleAlert, WifiOff } from 'lucide-react';

import { cn } from '@/lib/cn';
import { ApiError, getErrorMessage } from '@/lib/http';

import { Button } from './Button';

interface ErrorStateProps {
  error?: unknown;
  title?: string;
  /** Overrides the message derived from `error`. */
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function ErrorState({
  error,
  title,
  message,
  onRetry,
  retrying = false,
  size = 'md',
  className,
}: ErrorStateProps) {
  const offline = error instanceof ApiError && error.isNetworkError;
  const Icon = offline ? WifiOff : TriangleAlert;
  const heading = title ?? (offline ? "You're offline" : "Something didn't load");
  const requestId = error instanceof ApiError ? error.requestId : undefined;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'md' ? 'gap-3 px-6 py-12' : 'gap-2 px-4 py-6',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'flex items-center justify-center rounded-full bg-destructive-soft text-destructive',
          size === 'md' ? 'size-12 [&_svg]:size-6' : 'size-9 [&_svg]:size-4',
        )}
      >
        <Icon />
      </div>
      <div className="max-w-sm space-y-1">
        <h3 className={cn('font-semibold', size === 'md' ? 'text-base' : 'text-sm')}>{heading}</h3>
        <p className="text-sm text-muted-foreground">
          {message ?? getErrorMessage(error, 'An unexpected error occurred.')}
        </p>
        {requestId && <p className="text-xs text-muted-foreground/80">Reference: {requestId}</p>}
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          loading={retrying}
          leftIcon={<RefreshCw />}
        >
          Try again
        </Button>
      )}
    </div>
  );
}
