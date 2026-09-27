import { FolderKanban, LayoutGrid, List, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { MultiSelectFilter } from '@/components/common/MultiSelectFilter';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { AvatarGroup } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Can } from '@/features/organizations/components/Can';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { useDebouncedSearchParam } from '@/hooks/useDebouncedSearchParam';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/lib/cn';
import { paths } from '@/routes/paths';
import { PROJECT_SORTS, PROJECT_STATUSES, type Project, type ProjectListParams } from '@/types';
import { formatDate } from '@/utils/date';
import { readEnum, readList, readPositiveInt, withParams } from '@/utils/search-params';

import { useProjects } from '../api/projects.queries';
import { ProjectCard } from '../components/ProjectCard';
import { ProjectFormModal } from '../components/ProjectFormModal';
import { ProjectGridSkeleton } from '../components/ProjectGridSkeleton';
import { ProjectStatusBadge } from '../components/ProjectStatusBadge';
import { PROJECT_SORT_LABELS, PROJECT_STATUS_META } from '../constants';

const PAGE_SIZE = 12;
const VIEWS = ['grid', 'list'] as const;

const STATUS_OPTIONS = PROJECT_STATUSES.map((status) => ({
  value: status,
  label: PROJECT_STATUS_META[status].label,
}));

const SORT_OPTIONS = PROJECT_SORTS.map((sort) => ({
  value: sort,
  label: PROJECT_SORT_LABELS[sort],
}));

export function ProjectsPage() {
  useDocumentTitle('Projects');
  const organization = useActiveOrganization();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useDebouncedSearchParam('q');
  const [createOpen, setCreateOpen] = useState(false);

  const view = readEnum(searchParams, 'view', VIEWS) ?? 'grid';
  const params: ProjectListParams = {
    search: searchParams.get('q') ?? undefined,
    status: readList(searchParams, 'status', PROJECT_STATUSES),
    sort: readEnum(searchParams, 'sort', PROJECT_SORTS) ?? 'updated',
    page: readPositiveInt(searchParams, 'page', 1),
    pageSize: PAGE_SIZE,
  };
  if (!params.search) delete params.search;
  if (!params.status?.length) delete params.status;

  const projects = useProjects(organization.id, params);
  const hasFilters = Boolean(params.search || params.status?.length);

  const setParam = (updates: Record<string, string | readonly string[] | null>) =>
    setSearchParams((current) => withParams(current, { ...updates, page: null }), {
      replace: true,
    });

  const clearFilters = () => setParam({ q: null, status: null });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description={`All projects in ${organization.name}.`}
        actions={
          <Can permission="projects:create">
            <Button leftIcon={<Plus />} onClick={() => setCreateOpen(true)}>
              New project
            </Button>
          </Can>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          role="search"
          aria-label="Filter projects"
          className="flex flex-wrap items-center gap-2"
        >
          <div className="w-full sm:w-64">
            <SearchInput
              label="Search projects"
              placeholder="Search projects…"
              size="sm"
              value={search}
              onValueChange={setSearch}
            />
          </div>
          <MultiSelectFilter
            label="Status"
            options={STATUS_OPTIONS}
            selected={params.status ?? []}
            onChange={(values) => setParam({ status: values })}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-44">
            <Select
              size="sm"
              aria-label="Sort projects"
              value={params.sort}
              options={SORT_OPTIONS}
              onChange={(event) =>
                setParam({ sort: event.target.value === 'updated' ? null : event.target.value })
              }
            />
          </div>
          <SegmentedControl
            label="Layout"
            value={view}
            onValueChange={(next) => setParam({ view: next === 'grid' ? null : next })}
            options={[
              { value: 'grid', label: <LayoutGrid />, ariaLabel: 'Grid view' },
              { value: 'list', label: <List />, ariaLabel: 'List view' },
            ]}
          />
        </div>
      </div>

      {projects.isPending ? (
        <ProjectGridSkeleton />
      ) : projects.isError ? (
        <ErrorState
          error={projects.error}
          onRetry={() => void projects.refetch()}
          retrying={projects.isFetching}
        />
      ) : projects.data.data.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={<FolderKanban />}
            title="No projects match your filters"
            description="Try a different search or status."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<FolderKanban />}
            title="No projects yet"
            description="Create your first project to start planning work with your team."
            action={
              <Can permission="projects:create">
                <Button leftIcon={<Plus />} onClick={() => setCreateOpen(true)}>
                  New project
                </Button>
              </Can>
            }
          />
        )
      ) : (
        <div
          className={cn('space-y-6 transition-opacity', projects.isPlaceholderData && 'opacity-60')}
          aria-busy={projects.isPlaceholderData || undefined}
        >
          {view === 'grid' ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.data.data.map((project) => (
                <li key={project.id}>
                  <ProjectCard project={project} />
                </li>
              ))}
            </ul>
          ) : (
            <ProjectTable projects={projects.data.data} />
          )}
          <Pagination
            meta={projects.data.meta}
            onPageChange={(page) =>
              setSearchParams((current) => withParams(current, { page: page > 1 ? page : null }))
            }
          />
        </div>
      )}

      <ProjectFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function ProjectTable({ projects }: { projects: Project[] }) {
  return (
    <Table>
      <caption className="sr-only">Projects</caption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Project</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-48">Progress</TableHead>
          <TableHead>Members</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Due</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <TableRow key={project.id}>
            <TableCell>
              <Link
                to={paths.projectBoard(project.id)}
                className="font-medium text-foreground hover:underline"
              >
                {project.name}
              </Link>
              <p className="max-w-80 truncate text-xs text-muted-foreground">
                {project.key} · {project.description ?? 'No description'}
              </p>
            </TableCell>
            <TableCell>
              <ProjectStatusBadge status={project.status} />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <ProgressBar value={project.progress} label={`${project.name} progress`} />
                <span className="w-9 text-right text-xs tabular-nums">{project.progress}%</span>
              </div>
            </TableCell>
            <TableCell>
              <AvatarGroup users={project.members} max={3} size="xs" />
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {formatDate(project.createdAt)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {project.dueDate ? formatDate(project.dueDate) : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
