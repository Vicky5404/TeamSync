import { Search, X } from 'lucide-react';

import { Input, type InputProps } from '@/components/ui/Input';

interface SearchInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible label (the placeholder is not a label). */
  label: string;
}

export function SearchInput({ value, onValueChange, label, ...props }: SearchInputProps) {
  return (
    <Input
      type="search"
      role="searchbox"
      aria-label={label}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && value) {
          event.stopPropagation();
          onValueChange('');
        }
      }}
      leftIcon={<Search />}
      rightElement={
        value ? (
          <button
            type="button"
            onClick={() => onValueChange('')}
            aria-label="Clear search"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        ) : undefined
      }
      className="[&::-webkit-search-cancel-button]:hidden"
      {...props}
    />
  );
}
