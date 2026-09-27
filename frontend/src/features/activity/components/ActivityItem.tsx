import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Avatar } from '@/components/ui/Avatar';
import { TASK_PRIORITY_META, TASK_STATUS_META } from '@/features/tasks/constants';
import { paths } from '@/routes/paths';
import { TASK_PRIORITIES, TASK_STATUSES, type Activity, type ActivityTarget } from '@/types';
import { formatDateTime, formatRelativeTime } from '@/utils/date';

function statusLabel(value: string | null | undefined): string {
  return value && (TASK_STATUSES as readonly string[]).includes(value)
    ? TASK_STATUS_META[value as (typeof TASK_STATUSES)[number]].label
    : (value ?? 'unknown');
}

function priorityLabel(value: string | null | undefined): string {
  return value && (TASK_PRIORITIES as readonly string[]).includes(value)
    ? TASK_PRIORITY_META[value as (typeof TASK_PRIORITIES)[number]].label
    : (value ?? 'unknown');
}

function targetHref(target: ActivityTarget): string | null {
  if (target.type === 'task' && target.projectId) return paths.task(target.projectId, target.id);
  if (target.type === 'project') return paths.project(target.id);
  if (target.type === 'member') return paths.member(target.id);
  return null;
}

function TargetLink({ target }: { target: ActivityTarget }) {
  const href = targetHref(target);
  const text = target.identifier ? `${target.identifier} ${target.name}` : target.name;
  if (!href) return <span className="font-medium text-foreground">{text}</span>;
  return (
    <Link to={href} className="font-medium text-foreground hover:underline">
      {text}
    </Link>
  );
}

const Strong = ({ children }: { children: ReactNode }) => (
  <span className="font-medium text-foreground">{children}</span>
);

/** Human sentence for an activity entry (without the actor). */
function describe(activity: Activity, showTarget: boolean): ReactNode {
  const target = showTarget ? (
    <>
      {' '}
      <TargetLink target={activity.target} />
    </>
  ) : null;
  const { metadata } = activity;

  switch (activity.action) {
    case 'task.created':
      return <>created{target ?? ' this task'}</>;
    case 'task.completed':
      return <>completed{target ?? ' this task'}</>;
    case 'task.status_changed':
      return (
        <>
          moved{target} from <Strong>{statusLabel(metadata.from)}</Strong> to{' '}
          <Strong>{statusLabel(metadata.to)}</Strong>
        </>
      );
    case 'task.assigned':
      return metadata.assignee ? (
        <>
          assigned{target} to <Strong>{metadata.assignee}</Strong>
        </>
      ) : (
        <>unassigned{target ?? ' this task'}</>
      );
    case 'task.commented':
      return <>commented on{target ?? ' this task'}</>;
    case 'task.attachment_added':
      return (
        <>
          attached <Strong>{metadata.fileName ?? 'a file'}</Strong>
          {showTarget && <> to{target}</>}
        </>
      );
    case 'task.updated':
      if (metadata.field === 'priority') {
        return (
          <>
            changed the priority{showTarget && <> of{target}</>} to{' '}
            <Strong>{priorityLabel(metadata.to)}</Strong>
          </>
        );
      }
      return (
        <>
          updated the {metadata.field ?? 'details'}
          {showTarget && <> of{target}</>}
        </>
      );
    case 'project.created':
      return <>created the project{target}</>;
    case 'project.updated':
      return <>updated the project{target}</>;
    case 'member.joined':
      return <>joined the organization</>;
    default:
      return <>made a change{target}</>;
  }
}

interface ActivityItemProps {
  activity: Activity;
  /** Hide the target when the feed is already scoped to it (e.g. task drawer). */
  showTarget?: boolean;
}

export function ActivityItem({ activity, showTarget = true }: ActivityItemProps) {
  return (
    <li className="flex gap-3 py-2.5">
      <Avatar name={activity.actor.name} src={activity.actor.avatarUrl} size="sm" decorative />
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-muted-foreground">
          <Strong>{activity.actor.name}</Strong> {describe(activity, showTarget)}
        </p>
        <time
          dateTime={activity.createdAt}
          title={formatDateTime(activity.createdAt)}
          className="text-xs text-muted-foreground"
        >
          {formatRelativeTime(activity.createdAt)}
        </time>
      </div>
    </li>
  );
}
