import {
  ArrowLeft,
  CircleCheck,
  Clock,
  FolderKanban,
  ListTodo,
  Mail,
  TriangleAlert,
  UserX,
} from 'lucide-react';
import { Link, useParams } from 'react-router';

import { StatCard } from '@/components/common/StatCard';
import { Avatar } from '@/components/ui/Avatar';
import { buttonStyles } from '@/components/ui/button-styles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';
import { useOrganizationActivity } from '@/features/activity/api/activity.queries';
import { ActivityFeed } from '@/features/activity/components/ActivityFeed';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { ProjectStatusBadge } from '@/features/projects/components/ProjectStatusBadge';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/http';
import { paths } from '@/routes/paths';
import type { MemberProfile } from '@/types';
import { formatCurrentTimeInZone, formatLongDate, formatRelativeTime } from '@/utils/date';

import { useMember } from '../api/team.queries';
import { RoleBadge } from '../components/RoleBadge';

export function MemberProfilePage() {
  const { memberId = '' } = useParams();
  const organization = useActiveOrganization();
  const member = useMember(organization.id, memberId);
  useDocumentTitle(member.data?.user.name);

  const backLink = (
    <Link
      to={paths.team}
      className={buttonStyles({ variant: 'ghost', size: 'sm', className: '-ml-2' })}
    >
      <ArrowLeft /> Team
    </Link>
  );

  if (member.isPending) {
    return (
      <SkeletonGroup label="Loading member" className="space-y-6">
        <Skeleton className="h-8 w-24" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-24" />
          ))}
        </div>
      </SkeletonGroup>
    );
  }

  if (member.isError) {
    const notFound = member.error instanceof ApiError && member.error.isNotFound;
    return (
      <div className="space-y-4">
        {backLink}
        {notFound ? (
          <EmptyState
            icon={<UserX />}
            title="Member not found"
            description="This person may have left the organization."
          />
        ) : (
          <ErrorState error={member.error} onRetry={() => void member.refetch()} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {backLink}
      <MemberProfileContent profile={member.data} organizationId={organization.id} />
    </div>
  );
}

function MemberProfileContent({
  profile,
  organizationId,
}: {
  profile: MemberProfile;
  organizationId: string;
}) {
  const activity = useOrganizationActivity(organizationId, { actorId: profile.user.id, limit: 10 });
  const { user } = profile;

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={user.name} src={user.avatarUrl} size="xl" />
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
            <RoleBadge role={profile.role} />
          </div>
          {user.jobTitle && <p className="text-sm text-muted-foreground">{user.jobTitle}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <a
              href={`mailto:${user.email}`}
              className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline"
            >
              <Mail aria-hidden="true" className="size-4" /> {user.email}
            </a>
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden="true" className="size-4" />
              {user.timezone} · {formatCurrentTimeInZone(user.timezone)} local time
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Joined {formatLongDate(profile.joinedAt)}
            {profile.lastActiveAt && ` · Last active ${formatRelativeTime(profile.lastActiveAt)}`}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open tasks" value={profile.stats.openTasks} icon={<ListTodo />} />
        <StatCard
          label="Completed"
          value={profile.stats.completedTasks}
          icon={<CircleCheck />}
          tone="success"
        />
        <StatCard
          label="Overdue"
          value={profile.stats.overdueTasks}
          icon={<TriangleAlert />}
          tone={profile.stats.overdueTasks > 0 ? 'danger' : 'default'}
        />
        <StatCard label="Projects" value={profile.stats.projects} icon={<FolderKanban />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.projects.length === 0 ? (
              <EmptyState icon={<FolderKanban />} title="Not on any projects" size="sm" />
            ) : (
              <ul className="space-y-4">
                {profile.projects.map((project) => (
                  <li key={project.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={paths.projectBoard(project.id)}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {project.name}
                      </Link>
                      <ProjectStatusBadge status={project.status} />
                    </div>
                    <ProgressBar value={project.progress} label={`${project.name} progress`} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed
              items={activity.data?.pages.flatMap((page) => page.data)}
              isLoading={activity.isPending}
              error={activity.error}
              onRetry={() => void activity.refetch()}
              hasMore={activity.hasNextPage}
              onLoadMore={() => void activity.fetchNextPage()}
              isLoadingMore={activity.isFetchingNextPage}
              emptyMessage={`${user.name.split(' ')[0] ?? user.name} hasn't done anything yet.`}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
