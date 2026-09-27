import { Skeleton } from '@/components/ui/Skeleton';
import { useProject } from '@/features/projects/api/projects.queries';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { useMember } from '@/features/team/api/team.queries';

/** Breadcrumb label resolving a project name from the cache/API. */
export function ProjectCrumb({ projectId }: { projectId: string }) {
  const project = useProject(projectId);
  if (project.data) return <>{project.data.name}</>;
  if (project.isError) return <>Project</>;
  return <Skeleton className="inline-block h-4 w-24 align-middle" />;
}

export function MemberCrumb({ memberId }: { memberId: string }) {
  const organization = useActiveOrganization();
  const member = useMember(organization.id, memberId);
  if (member.data) return <>{member.data.user.name}</>;
  if (member.isError) return <>Member</>;
  return <Skeleton className="inline-block h-4 w-24 align-middle" />;
}
