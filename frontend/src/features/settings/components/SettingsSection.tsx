import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface SettingsSectionProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tone?: 'default' | 'danger';
  className?: string;
}

/** Card-style block used on every settings page. */
export function SettingsSection({
  title,
  description,
  children,
  footer,
  tone = 'default',
  className,
}: SettingsSectionProps) {
  const headingId = `settings-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'rounded-xl border bg-surface shadow-xs',
        tone === 'danger' && 'border-destructive/40',
        className,
      )}
    >
      <div className="space-y-1 px-5 pt-5">
        <h2
          id={headingId}
          className={cn('text-base font-semibold', tone === 'danger' && 'text-destructive')}
        >
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t bg-surface-muted/40 px-5 py-3">
          {footer}
        </div>
      )}
    </section>
  );
}
