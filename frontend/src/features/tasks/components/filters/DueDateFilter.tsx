import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Popover } from '@/components/ui/Popover';
import { cn } from '@/lib/cn';
import { DUE_PRESETS, type DuePreset } from '@/types';
import { formatDate } from '@/utils/date';

import { DUE_PRESET_LABELS } from '../../constants';

interface DueDateFilterProps {
  due: DuePreset | undefined;
  from: string | undefined;
  to: string | undefined;
  onChange: (due: DuePreset | undefined, range?: { from?: string; to?: string }) => void;
}

function summarize(due: DuePreset | undefined, from?: string, to?: string): string | null {
  if (due) return DUE_PRESET_LABELS[due];
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `After ${formatDate(from)}`;
  if (to) return `Before ${formatDate(to)}`;
  return null;
}

export function DueDateFilter({ due, from, to, onChange }: DueDateFilterProps) {
  const summary = summarize(due, from, to);

  return (
    <Popover
      label="Filter by due date"
      className="w-72 p-1"
      trigger={(props) => (
        <Button
          {...props}
          variant="outline"
          size="sm"
          className={cn(summary && 'border-primary/40 bg-primary-soft/50')}
        >
          <CalendarDays />
          <span className="max-w-40 truncate">{summary ?? 'Due date'}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      )}
    >
      {(close) => (
        <DueDatePanel
          due={due}
          from={from}
          to={to}
          onChange={(nextDue, range) => {
            onChange(nextDue, range);
            close();
          }}
        />
      )}
    </Popover>
  );
}

function DueDatePanel({ due, from, to, onChange }: DueDateFilterProps) {
  const [customFrom, setCustomFrom] = useState(from ?? '');
  const [customTo, setCustomTo] = useState(to ?? '');
  const invalidRange = Boolean(customFrom && customTo && customFrom > customTo);

  return (
    <div>
      <ul className="space-y-0.5" aria-label="Due date presets">
        {DUE_PRESETS.map((preset) => {
          const selected = due === preset;
          return (
            <li key={preset}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(selected ? undefined : preset)}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent"
              >
                {DUE_PRESET_LABELS[preset]}
                {selected && (
                  <Check aria-hidden="true" className="size-4 text-primary" strokeWidth={3} />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <form
        className="mt-1 space-y-3 border-t px-2.5 pt-3 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (invalidRange) return;
          onChange(undefined, { from: customFrom || undefined, to: customTo || undefined });
        }}
      >
        <p className="text-xs font-medium text-muted-foreground">Custom range</p>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="From">
            <Input
              type="date"
              size="sm"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
            />
          </FormField>
          <FormField label="To">
            <Input
              type="date"
              size="sm"
              value={customTo}
              min={customFrom || undefined}
              onChange={(event) => setCustomTo(event.target.value)}
            />
          </FormField>
        </div>
        {invalidRange && (
          <p className="text-xs text-destructive">The start date must be before the end date.</p>
        )}
        <div className="flex justify-between gap-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onChange(undefined, {})}
            disabled={!due && !from && !to}
          >
            Clear
          </Button>
          <Button type="submit" size="xs" disabled={invalidRange || (!customFrom && !customTo)}>
            Apply range
          </Button>
        </div>
      </form>
    </div>
  );
}
