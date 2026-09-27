import { useState } from 'react';

import { cn } from '@/lib/cn';
import { getInitials } from '@/utils/format';

const SIZES = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-16 text-lg',
} as const;

export type AvatarSize = keyof typeof SIZES;

// Background colors chosen for ≥ 4.5:1 contrast with white initials.
const FALLBACK_COLORS = [
  'bg-rose-600',
  'bg-orange-700',
  'bg-amber-700',
  'bg-emerald-700',
  'bg-teal-700',
  'bg-sky-700',
  'bg-indigo-600',
  'bg-violet-600',
  'bg-fuchsia-700',
  'bg-slate-600',
] as const;

function colorFor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length] ?? 'bg-slate-600';
}

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  shape?: 'circle' | 'square';
  className?: string;
  /** Hide from assistive tech when the name is already rendered next to it. */
  decorative?: boolean;
}

export function Avatar({
  name,
  src,
  size = 'md',
  shape = 'circle',
  className,
  decorative = false,
}: AvatarProps) {
  const classes = cn(
    'relative inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold text-white select-none',
    shape === 'circle' ? 'rounded-full' : 'rounded-lg',
    SIZES[size],
    className,
  );
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img' as const, 'aria-label': name };

  return (
    <span className={cn(classes, colorFor(name))} {...a11y}>
      <span aria-hidden="true">{getInitials(name)}</span>
      {/* Keyed by src so a new URL resets the error state. */}
      {src && <AvatarImage key={src} src={src} />}
    </span>
  );
}

function AvatarImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="absolute inset-0 size-full object-cover"
    />
  );
}

interface AvatarGroupProps {
  users: ReadonlyArray<{ id: string; name: string; avatarUrl: string | null }>;
  max?: number;
  size?: AvatarSize;
  className?: string;
}

export function AvatarGroup({ users, max = 4, size = 'sm', className }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;
  const label = users.map((user) => user.name).join(', ');

  return (
    <div role="img" aria-label={label} title={label} className={cn('flex -space-x-1', className)}>
      {visible.map((user) => (
        <Avatar
          key={user.id}
          name={user.name}
          src={user.avatarUrl}
          size={size}
          decorative
          className="ring-2 ring-surface"
        />
      ))}
      {overflow > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-surface-muted font-medium text-muted-foreground ring-2 ring-surface',
            SIZES[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
