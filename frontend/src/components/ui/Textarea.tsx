import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

import { CONTROL_BASE } from './control-styles';
import { useFormFieldControl } from './form-field-context';

export interface TextareaProps extends ComponentProps<'textarea'> {
  invalid?: boolean;
  /** Grow with content (where supported) instead of scrolling. */
  autoGrow?: boolean;
}

export function Textarea({
  invalid: invalidProp,
  autoGrow = true,
  className,
  rows = 3,
  ...props
}: TextareaProps) {
  const { invalid: _invalid, ...controlProps } = useFormFieldControl(props, invalidProp);
  return (
    <textarea
      rows={rows}
      className={cn(
        CONTROL_BASE,
        'min-h-20 resize-y px-3 py-2 leading-relaxed',
        autoGrow && 'field-sizing-content max-h-96',
        className,
      )}
      {...controlProps}
    />
  );
}
