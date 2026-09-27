import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { Input, type InputProps } from '@/components/ui/Input';

export function PasswordInput(props: Omit<InputProps, 'type' | 'rightElement'>) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      type={visible ? 'text' : 'password'}
      rightElement={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
      }
      {...props}
    />
  );
}
