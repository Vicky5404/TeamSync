import { env } from '@/lib/env';
import { cn } from '@/lib/cn';

interface LogoProps {
  /** Hide the wordmark (collapsed sidebar). */
  compact?: boolean;
  className?: string;
}

export function Logo({ compact = false, className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-7 shrink-0">
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path
          d="M9 11.5h9.5M9 16h14M9 20.5h7"
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx="22.5" cy="11.5" r="2.2" fill="#c7d2fe" />
      </svg>
      <span className={cn('text-base font-semibold tracking-tight', compact && 'sr-only')}>
        {env.appName}
      </span>
    </span>
  );
}
