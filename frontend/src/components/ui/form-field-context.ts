import { createContext, useContext } from 'react';

export interface FormFieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

export const FormFieldContext = createContext<FormFieldContextValue | null>(null);

interface ControlProps {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
  required?: boolean;
}

/**
 * Wires a form control to its surrounding `<FormField>` (id, error/hint
 * descriptions, invalid state). Explicit props always win.
 */
export function useFormFieldControl<P extends ControlProps>(props: P, invalidProp?: boolean) {
  const field = useContext(FormFieldContext);
  const invalid = invalidProp ?? field?.invalid ?? false;
  return {
    ...props,
    id: props.id ?? field?.id,
    'aria-describedby': props['aria-describedby'] ?? field?.describedBy,
    'aria-invalid': props['aria-invalid'] ?? (invalid || undefined),
    required: props.required ?? (field?.required || undefined),
    invalid,
  };
}
