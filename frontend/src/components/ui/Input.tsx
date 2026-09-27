import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { CONTROL_BASE, CONTROL_SIZES, type ControlSize } from './control-styles';
import { useFormFieldControl } from './form-field-context';

export interface InputProps extends Omit<ComponentProps<'input'>, 'size'> {
  size?: ControlSize;
  invalid?: boolean;
  /** Decorative icon rendered inside the left edge. */
  leftIcon?: ReactNode;
  /** Interactive element rendered inside the right edge (e.g. show-password toggle). */
  rightElement?: ReactNode;
}

export function Input({
  size = 'md',
  invalid: invalidProp,
  leftIcon,
  rightElement,
  className,
  ...props
}: InputProps) {
  const { invalid: _invalid, ...controlProps } = useFormFieldControl(props, invalidProp);

  const input = (
    <input
      className={cn(
        CONTROL_BASE,
        CONTROL_SIZES[size],
        leftIcon && 'pl-9',
        rightElement && 'pr-10',
        className,
      )}
      {...controlProps}
    />
  );

  if (!leftIcon && !rightElement) return input;

  return (
    <div className="relative w-full">
      {leftIcon && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground [&_svg]:size-4"
        >
          {leftIcon}
        </span>
      )}
      {input}
      {rightElement && (
        <span className="absolute inset-y-0 right-1 flex items-center">{rightElement}</span>
      )}
    </div>
  );
}
