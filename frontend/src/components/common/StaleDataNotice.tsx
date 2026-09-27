import { CloudOff } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/http';

interface StaleDataNoticeProps {
  error: unknown;
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}

/**
 * Shown next to data that is still on screen after a background refresh failed
 * (partial data), instead of replacing it with a full error state.
 */
export function StaleDataNotice({
  error,
  onRetry,
  retrying = false,
  className,
}: StaleDataNoticeProps) {
  return (
    <p
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground',
        className,
      )}
    >
      <CloudOff aria-hidden="true" className="size-3.5 shrink-0" />
      <span>Showing the last loaded data — {getErrorMessage(error, "couldn't refresh.")}</span>
      <Button variant="link" size="xs" onClick={onRetry} loading={retrying}>
        Retry
      </Button>
    </p>
  );
}
