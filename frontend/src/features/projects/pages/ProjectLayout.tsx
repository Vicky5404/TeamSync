import {
  Activity,
  ChartColumn,
  ChartGantt,
  EllipsisVertical,
  FolderX,
  LayoutDashboard,
  List,
  Pencil,
  SquareKanban,
  Trash,
} from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router';

import { AvatarGroup } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { buttonStyles } from '@/components/ui/button-styles';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';
import { TabNav } from '@/components/ui/Tabs';
import { usePermissions } from '@/features/organizations/active-organization';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/http';
import { paths } from '@/routes/paths';
import { toast } from '@/store/toast.store';
import type { Project } from '@/types';

import { useDeleteProject, useProject } from '../api/projects.queries';
import { ProjectFormModal } from '../components/ProjectFormModal';
import { ProjectStatusBadge } from '../components/ProjectStatusBadge';
import type { ProjectOutletContext } from '../project-context';

export function ProjectLayout() {
  const { projectId = '' } = useParams();
  const project = useProject(projectId);
  useDocumentTitle(project.data?.name);

  if (project.isPending) return <ProjectHeaderSkeleton />;

  if (project.isError) {
    const error = project.error;
    if (error instanceof ApiError && (error.isNotFound || error.isForbidden)) {
      return (
        <EmptyState
          icon={<FolderX />}
          title="Project not found"
          description="It may have been deleted, or you don't have access to it."
          action={
            <Link to={paths.projects} className={buttonStyles({ variant: 'outline' })}>
              Back to projects
            </Link>
          }
        />
      );
    }
    return (
      <ErrorState
        error={error}
        onRetry={() => void project.refetch()}
        retrying={project.isFetching}
      />
    );
  }

  const context: ProjectOutletContext = { project: project.data };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <ProjectHeader project={project.data} />
        <div className="border-b">
          <TabNav
            label="Project views"
            items={[
              {
                to: paths.projectOverview(projectId),
                label: 'Overview',
                icon: <LayoutDashboard />,
              },
              { to: paths.projectBoard(projectId), label: 'Board', icon: <SquareKanban /> },
              { to: paths.projectList(projectId), label: 'List', icon: <List /> },
              { to: paths.projectTimeline(projectId), label: 'Timeline', icon: <ChartGantt /> },
              { to: paths.projectAnalytics(projectId), label: 'Analytics', icon: <ChartColumn /> },
              { to: paths.projectActivity(projectId), label: 'Activity', icon: <Activity /> },
            ]}
          />
        </div>
      </div>
      <Outlet context={context} />
    </div>
  );
}

function ProjectHeader({ project }: { project: Project }) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const deleteProject = useDeleteProject(project.organizationId);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canUpdate = can('projects:update');
  const canDelete = can('projects:delete');

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {project.key}
          </span>
          <ProjectStatusBadge status={project.status} />
        </div>
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
          {project.name}
        </h1>
        {project.description && (
          <p className="line-clamp-2 max-w-3xl text-sm text-muted-foreground">
            {project.description}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <AvatarGroup users={project.members} max={5} size="sm" />
        {(canUpdate || canDelete) && (
          <Dropdown
            label="Project actions"
            trigger={(props) => (
              <Button {...props} variant="outline" size="icon-sm" aria-label="Project actions">
                <EllipsisVertical />
              </Button>
            )}
          >
            {canUpdate && (
              <DropdownItem icon={<Pencil />} onSelect={() => setEditOpen(true)}>
                Edit project
              </DropdownItem>
            )}
            {canUpdate && canDelete && <DropdownSeparator />}
            {canDelete && (
              <DropdownItem icon={<Trash />} destructive onSelect={() => setDeleteOpen(true)}>
                Delete project
              </DropdownItem>
            )}
          </Dropdown>
        )}
      </div>

      <ProjectFormModal open={editOpen} onClose={() => setEditOpen(false)} project={project} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete project?"
        description={`“${project.name}” and all of its ${project.taskCounts.total} tasks will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete project"
        confirmationText={project.key}
        loading={deleteProject.isPending}
        onConfirm={() =>
          deleteProject.mutate(project.id, {
            onSuccess: () => {
              toast.success(`${project.name} deleted`);
              setDeleteOpen(false);
              void navigate(paths.projects, { replace: true });
            },
          })
        }
      />
    </header>
  );
}

function ProjectHeaderSkeleton() {
  return (
    <SkeletonGroup label="Loading project" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-9 w-full max-w-xl" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </SkeletonGroup>
  );
}
