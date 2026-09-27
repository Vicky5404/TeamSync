import { cn } from '@/lib/cn';

import { scorePassword } from '../schemas';

const LEVELS = [
  { label: 'Too weak', color: 'bg-destructive' },
  { label: 'Weak', color: 'bg-destructive' },
  { label: 'Fair', color: 'bg-warning' },
  { label: 'Good', color: 'bg-success' },
  { label: 'Strong', color: 'bg-success' },
] as const;

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const score = scorePassword(password);
  const level = LEVELS[score] ?? LEVELS[0];

  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn(
              'h-1 flex-1 rounded-full',
              step <= score ? level.color : 'bg-surface-muted',
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Password strength: <span className="font-medium text-foreground">{level.label}</span>
      </p>
    </div>
  );
}
