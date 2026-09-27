import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { CONTROL_BASE, CONTROL_SIZES, type ControlSize } from './control-styles';
import { useFormFieldControl } from './form-field-context';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> extends Omit<
  ComponentProps<'select'>,
  'size' | 'children'
> {
  options?: ReadonlyArray<SelectOption<T>>;
  /** Renders a disabled, empty first option. */
  placeholder?: string;
  size?: ControlSize;
  invalid?: boolean;
  children?: ReactNode;
}

/**
 * Styled native `<select>`: fully accessible and keyboard/mobile friendly by
 * default. Use `Dropdown`/filter menus for richer pickers.
 */
export function Select<T extends string = string>({
  options,
  placeholder,
  size = 'md',
  invalid: invalidProp,
  className,
  children,
  ...props
}: SelectProps<T>) {
  const { invalid: _invalid, ...controlProps } = useFormFieldControl(props, invalidProp);
  return (
    <div className="relative w-full">
      <select
        className={cn(CONTROL_BASE, CONTROL_SIZES[size], 'appearance-none pr-9', className)}
        {...controlProps}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
