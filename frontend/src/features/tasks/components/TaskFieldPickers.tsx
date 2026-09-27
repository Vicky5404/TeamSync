import { ChevronDown, Plus, UserX } from 'lucide-react';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import {
  Dropdown,
  DropdownCheckboxItem,
  DropdownLabel,
  DropdownRadioItem,
  DropdownSeparator,
  DropdownItem,
} from '@/components/ui/Dropdown';
import { cn } from '@/lib/cn';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Label,
  type TaskPriority,
  type TaskStatus,
  type UserSummary,
} from '@/types';

import { LABEL_DOT_CLASSES, TASK_PRIORITY_META, TASK_STATUS_META } from '../constants';
import { LabelChip, TaskPriorityIndicator, TaskStatusIcon } from './TaskBadges';

const TRIGGER_CLASS = 'h-8 justify-start gap-2 px-2 font-normal';

interface PickerProps<T> {
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Accessible name for the trigger. */
  label: string;
}

export function StatusPicker({ value, onChange, disabled, label }: PickerProps<TaskStatus>) {
  return (
    <Dropdown
      label={label}
      placement="bottom-start"
      trigger={(props) => (
        <Button
          {...props}
          variant="ghost"
          disabled={disabled}
          aria-label={`${label}: ${TASK_STATUS_META[value].label}`}
          className={TRIGGER_CLASS}
        >
          <TaskStatusIcon status={value} />
          {TASK_STATUS_META[value].label}
        </Button>
      )}
    >
      {TASK_STATUSES.map((status) => (
        <DropdownRadioItem
          key={status}
          checked={status === value}
          onSelect={() => onChange(status)}
          icon={<TaskStatusIcon status={status} />}
        >
          {TASK_STATUS_META[status].label}
        </DropdownRadioItem>
      ))}
    </Dropdown>
  );
}

export function PriorityPicker({ value, onChange, disabled, label }: PickerProps<TaskPriority>) {
  return (
    <Dropdown
      label={label}
      placement="bottom-start"
      trigger={(props) => (
        <Button
          {...props}
          variant="ghost"
          disabled={disabled}
          aria-label={`${label}: ${TASK_PRIORITY_META[value].label}`}
          className={TRIGGER_CLASS}
        >
          <TaskPriorityIndicator priority={value} showLabel />
        </Button>
      )}
    >
      {[...TASK_PRIORITIES].reverse().map((priority) => (
        <DropdownRadioItem
          key={priority}
          checked={priority === value}
          onSelect={() => onChange(priority)}
        >
          <TaskPriorityIndicator priority={priority} showLabel />
        </DropdownRadioItem>
      ))}
    </Dropdown>
  );
}

interface AssigneePickerProps extends PickerProps<UserSummary | null> {
  people: readonly UserSummary[];
}

export function AssigneePicker({ value, onChange, disabled, label, people }: AssigneePickerProps) {
  return (
    <Dropdown
      label={label}
      placement="bottom-start"
      className="max-h-80 w-64"
      trigger={(props) => (
        <Button
          {...props}
          variant="ghost"
          disabled={disabled}
          aria-label={`${label}: ${value?.name ?? 'Unassigned'}`}
          className={TRIGGER_CLASS}
        >
          {value ? (
            <>
              <Avatar name={value.name} src={value.avatarUrl} size="xs" decorative />
              <span className="truncate">{value.name}</span>
            </>
          ) : (
            <>
              <UserX className="text-muted-foreground" />
              <span className="text-muted-foreground">Unassigned</span>
            </>
          )}
        </Button>
      )}
    >
      <DropdownRadioItem checked={value === null} onSelect={() => onChange(null)} icon={<UserX />}>
        Unassigned
      </DropdownRadioItem>
      <DropdownSeparator />
      {people.map((person) => (
        <DropdownRadioItem
          key={person.id}
          checked={value?.id === person.id}
          onSelect={() => onChange(person)}
          icon={<Avatar name={person.name} src={person.avatarUrl} size="xs" decorative />}
        >
          {person.name}
        </DropdownRadioItem>
      ))}
    </Dropdown>
  );
}

interface LabelPickerProps {
  value: readonly Label[];
  options: readonly Label[];
  onChange: (labels: Label[]) => void;
  disabled?: boolean;
  label: string;
  variant?: 'chips' | 'button';
}

/** Multi-select label picker; the trigger shows the selected labels as chips. */
export function LabelPicker({
  value,
  options,
  onChange,
  disabled,
  label,
  variant = 'chips',
}: LabelPickerProps) {
  const selectedIds = new Set(value.map((item) => item.id));
  const toggle = (option: Label, checked: boolean) =>
    onChange(checked ? [...value, option] : value.filter((item) => item.id !== option.id));

  return (
    <Dropdown
      label={label}
      placement="bottom-start"
      className="max-h-80 w-60"
      trigger={(props) => (
        <Button
          {...props}
          variant={variant === 'button' ? 'outline' : 'ghost'}
          disabled={disabled}
          aria-label={`${label}: ${value.length ? value.map((item) => item.name).join(', ') : 'none'}`}
          className={cn(
            TRIGGER_CLASS,
            'h-auto min-h-8 flex-wrap py-1',
            variant === 'button' && 'w-full',
          )}
        >
          {value.length > 0 ? (
            value.map((item) => <LabelChip key={item.id} label={item} />)
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Plus className="size-3.5" /> Add labels
            </span>
          )}
          {variant === 'button' && (
            <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
          )}
        </Button>
      )}
    >
      <DropdownLabel>Labels</DropdownLabel>
      {options.length === 0 && (
        <p className="px-2.5 py-2 text-sm text-muted-foreground">No labels available</p>
      )}
      {options.map((option) => (
        <DropdownCheckboxItem
          key={option.id}
          checked={selectedIds.has(option.id)}
          onCheckedChange={(checked) => toggle(option, checked)}
          icon={<span className={cn('size-2.5 rounded-full', LABEL_DOT_CLASSES[option.color])} />}
        >
          {option.name}
        </DropdownCheckboxItem>
      ))}
      {value.length > 0 && (
        <>
          <DropdownSeparator />
          <DropdownItem onSelect={() => onChange([])}>Clear labels</DropdownItem>
        </>
      )}
    </Dropdown>
  );
}
