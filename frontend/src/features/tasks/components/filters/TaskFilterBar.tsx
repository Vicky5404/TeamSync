import { CircleUserRound, Flag, ListFilter, Tag, UserX } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

import { SearchInput } from '@/components/common/SearchInput';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useLabels } from '@/features/organizations/api/organizations.queries';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { useMembers } from '@/features/team/api/team.queries';
import { useDebouncedSearchParam } from '@/hooks/useDebouncedSearchParam';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/types';

import { LABEL_DOT_CLASSES, TASK_PRIORITY_META, TASK_STATUS_META } from '../../constants';
import { TASK_FILTER_PARAMS, useTaskFilters } from '../../hooks/useTaskFilters';
import { TaskStatusIcon } from '../TaskBadges';
import { DueDateFilter } from './DueDateFilter';
import { MultiSelectFilter, type FilterOption } from '@/components/common/MultiSelectFilter';

interface TaskFilterBarProps {
  /** Hide filters that don't apply in the current view. */
  hide?: ReadonlyArray<'status' | 'assignee'>;
  /** Right-aligned actions (e.g. "New task"). */
  actions?: ReactNode;
}

const STATUS_OPTIONS: FilterOption[] = TASK_STATUSES.map((status) => ({
  value: status,
  label: TASK_STATUS_META[status].label,
  icon: <TaskStatusIcon status={status} />,
}));

const PRIORITY_OPTIONS: FilterOption[] = [...TASK_PRIORITIES].reverse().map((priority) => {
  const Icon = TASK_PRIORITY_META[priority].icon;
  return {
    value: priority,
    label: TASK_PRIORITY_META[priority].label,
    icon: <Icon className={TASK_PRIORITY_META[priority].colorClass} />,
  };
});

/** Search + shareable (URL-backed) task filters. */
export function TaskFilterBar({ hide = [], actions }: TaskFilterBarProps) {
  const organization = useActiveOrganization();
  const members = useMembers(organization.id);
  const labels = useLabels(organization.id);
  const { state, setList, setDue, clear, activeCount } = useTaskFilters();
  const [search, setSearch] = useDebouncedSearchParam(TASK_FILTER_PARAMS.search);

  const assigneeOptions = useMemo<FilterOption[]>(
    () => [
      { value: 'me', label: 'Assigned to me', icon: <CircleUserRound /> },
      { value: 'unassigned', label: 'Unassigned', icon: <UserX /> },
      ...(members.data ?? []).map((member) => ({
        value: member.user.id,
        label: member.user.name,
        icon: <Avatar name={member.user.name} src={member.user.avatarUrl} size="xs" decorative />,
      })),
    ],
    [members.data],
  );

  const labelOptions = useMemo<FilterOption[]>(
    () =>
      (labels.data ?? []).map((label) => ({
        value: label.id,
        label: label.name,
        icon: <span className={`size-2.5 rounded-full ${LABEL_DOT_CLASSES[label.color]}`} />,
      })),
    [labels.data],
  );

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div role="search" aria-label="Filter tasks" className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-60">
          <SearchInput
            label="Search tasks"
            placeholder="Search tasks…"
            size="sm"
            value={search}
            onValueChange={setSearch}
          />
        </div>
        {!hide.includes('status') && (
          <MultiSelectFilter
            label="Status"
            icon={<ListFilter />}
            options={STATUS_OPTIONS}
            selected={state.status}
            onChange={(values) => setList('status', values)}
          />
        )}
        <MultiSelectFilter
          label="Priority"
          icon={<Flag />}
          options={PRIORITY_OPTIONS}
          selected={state.priority}
          onChange={(values) => setList('priority', values)}
        />
        {!hide.includes('assignee') && (
          <MultiSelectFilter
            label="Assignee"
            icon={<CircleUserRound />}
            options={assigneeOptions}
            selected={state.assignee}
            onChange={(values) => setList('assignee', values)}
          />
        )}
        <MultiSelectFilter
          label="Labels"
          icon={<Tag />}
          options={labelOptions}
          selected={state.labels}
          onChange={(values) => setList('labels', values)}
          emptyMessage="No labels in this organization"
        />
        <DueDateFilter due={state.due} from={state.dueFrom} to={state.dueTo} onChange={setDue} />
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear filters
          </Button>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
