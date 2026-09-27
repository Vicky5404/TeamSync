import { LoaderCircle } from 'lucide-react';

import { cn } from '@/lib/cn';

interface SpinnerProps {
  className?: string;
  /** Accessible label; when provided the spinner is announced as a status. */
  label?: string;
}

export function Spinner({ className, label }: SpinnerProps) {
  const icon = <LoaderCircle aria-hidden="true" className={cn('size-4 animate-spin', className)} />;
  if (!label) return icon;
  return (
    <span role="status" className="inline-flex items-center">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}
