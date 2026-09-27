import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-xs';

const BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors select-none ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ' +
  '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover',
  secondary: 'bg-surface-muted text-foreground hover:bg-accent',
  outline: 'border border-input bg-surface text-foreground shadow-xs hover:bg-accent',
  ghost: 'text-foreground hover:bg-accent',
  destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive-hover',
  link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 rounded-md px-2 text-xs',
  sm: 'h-8 px-3',
  md: 'h-9 px-4',
  lg: 'h-10 px-5',
  icon: 'size-9',
  'icon-sm': 'size-8',
  'icon-xs': 'size-7 rounded-md',
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Class names for button-looking elements (e.g. router links styled as buttons). */
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  className,
}: ButtonStyleOptions = {}): string {
  return cn(BASE, VARIANTS[variant], variant === 'link' ? undefined : SIZES[size], className);
}
