import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import {
  Dropdown,
  DropdownCheckboxItem,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from '@/components/ui/Dropdown';
import { cn } from '@/lib/cn';

export interface FilterOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface MultiSelectFilterProps {
  label: string;
  icon?: ReactNode;
  options: readonly FilterOption[];
  selected: readonly string[];
  onChange: (values: string[]) => void;
  emptyMessage?: string;
}

/** Filter button with a checkbox menu; the trigger shows the active count. */
export function MultiSelectFilter({
  label,
  icon,
  options,
  selected,
  onChange,
  emptyMessage = 'No options',
}: MultiSelectFilterProps) {
  const toggle = (value: string, checked: boolean) =>
    onChange(checked ? [...selected, value] : selected.filter((item) => item !== value));

  const active = selected.length > 0;

  return (
    <Dropdown
      label={`Filter by ${label.toLowerCase()}`}
      placement="bottom-start"
      className="max-h-80 w-60"
      trigger={(props) => (
        <Button
          {...props}
          variant="outline"
          size="sm"
          className={cn(active && 'border-primary/40 bg-primary-soft/50')}
          aria-label={active ? `${label}: ${selected.length} selected` : label}
        >
          {icon}
          {label}
          {active && (
            <span className="rounded bg-primary px-1 text-[11px] font-semibold text-primary-foreground tabular-nums">
              {selected.length}
            </span>
          )}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      )}
    >
      <DropdownLabel>{label}</DropdownLabel>
      {options.length === 0 && (
        <p className="px-2.5 py-2 text-sm text-muted-foreground">{emptyMessage}</p>
      )}
      {options.map((option) => (
        <DropdownCheckboxItem
          key={option.value}
          checked={selected.includes(option.value)}
          onCheckedChange={(checked) => toggle(option.value, checked)}
          icon={option.icon}
        >
          {option.label}
        </DropdownCheckboxItem>
      ))}
      {active && (
        <>
          <DropdownSeparator />
          <DropdownItem onSelect={() => onChange([])}>Clear {label.toLowerCase()}</DropdownItem>
        </>
      )}
    </Dropdown>
  );
}
