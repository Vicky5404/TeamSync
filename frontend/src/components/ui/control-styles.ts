/** Shared look for text-like form controls (inputs, selects, textareas). */
export const CONTROL_BASE =
  'w-full rounded-lg border border-input bg-surface text-sm text-foreground shadow-xs transition-colors ' +
  'placeholder:text-muted-foreground/80 ' +
  'focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/30 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 ' +
  'aria-invalid:border-destructive aria-invalid:focus-visible:outline-destructive/30';

export const CONTROL_SIZES = {
  sm: 'h-8 px-2.5',
  md: 'h-9 px-3',
  lg: 'h-10 px-3.5',
} as const;

export type ControlSize = keyof typeof CONTROL_SIZES;
