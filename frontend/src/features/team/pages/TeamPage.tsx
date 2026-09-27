import { UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select } from '@/components/ui/Select';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { useCurrentUser } from '@/features/auth/api/auth.queries';
import {
  usePermissions,
  useActiveOrganization,
} from '@/features/organizations/active-organization';
import { useDebouncedSearchParam } from '@/hooks/useDebouncedSearchParam';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/lib/cn';
import { ROLE_LABELS } from '@/lib/permissions';
import { toast } from '@/store/toast.store';
import { ROLES, type Member } from '@/types';
import { readEnum, withParams } from '@/utils/search-params';

import { useInvitations, useMembers, useRemoveMember } from '../api/team.queries';
import { InvitationsList } from '../components/InvitationsList';
import { InviteMembersModal } from '../components/InviteMembersModal';
import { MembersTable } from '../components/MembersTable';

const TABS = ['members', 'invitations'] as const;
type TeamTab = (typeof TABS)[number];

const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'All roles' },
  ...ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];

export function TeamPage() {
  useDocumentTitle('Team');
  const organization = useActiveOrganization();
  const { can, role: actorRole } = usePermissions();
  const { data: currentUser } = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useDebouncedSearchParam('q');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toRemove, setToRemove] = useState<Member | null>(null);

  const canInvite = can('members:invite');
  const tab: TeamTab = canInvite ? (readEnum(searchParams, 'tab', TABS) ?? 'members') : 'members';
  const roleFilter = readEnum(searchParams, 'role', ROLES);
  const query = searchParams.get('q') ?? '';

  const members = useMembers(organization.id, {
    ...(query ? { search: query } : {}),
    ...(roleFilter ? { role: roleFilter } : {}),
  });
  const invitations = useInvitations(organization.id, canInvite);
  const removeMember = useRemoveMember(organization.id);

  const setTab = (next: TeamTab) =>
    setSearchParams((current) => withParams(current, { tab: next === 'members' ? null : next }), {
      replace: true,
    });

  const pendingInvites = invitations.data?.filter((item) => item.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description={`${organization.memberCount} member${organization.memberCount === 1 ? '' : 's'} in ${organization.name}.`}
        actions={
          canInvite && (
            <Button leftIcon={<UserPlus />} onClick={() => setInviteOpen(true)}>
              Invite members
            </Button>
          )
        }
      />

      {!can('members:manage') && (
        <Alert variant="info">
          You&apos;re a {ROLE_LABELS[actorRole].toLowerCase()} in this organization. Only owners and
          admins can change roles or remove members.
        </Alert>
      )}

      {canInvite && (
        <Tabs
          idBase="team"
          label="Team sections"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'members', label: 'Members', count: members.data?.length },
            { value: 'invitations', label: 'Pending invitations', count: pendingInvites },
          ]}
        />
      )}

      <TabPanel idBase="team" value={tab} className="space-y-4">
        {tab === 'invitations' ? (
          <InvitationsList organizationId={organization.id} canManage={canInvite} />
        ) : (
          <>
            <div role="search" aria-label="Filter members" className="flex flex-wrap gap-2">
              <div className="w-full sm:w-72">
                <SearchInput
                  label="Search members"
                  placeholder="Search by name or email…"
                  size="sm"
                  value={search}
                  onValueChange={setSearch}
                />
              </div>
              <div className="w-40">
                <Select
                  size="sm"
                  aria-label="Filter by role"
                  value={roleFilter ?? ''}
                  options={ROLE_FILTER_OPTIONS}
                  onChange={(event) =>
                    setSearchParams(
                      (current) => withParams(current, { role: event.target.value || null }),
                      { replace: true },
                    )
                  }
                />
              </div>
            </div>

            {members.isPending ? (
              <SkeletonGroup label="Loading members" className="space-y-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </SkeletonGroup>
            ) : members.isError ? (
              <ErrorState
                error={members.error}
                onRetry={() => void members.refetch()}
                retrying={members.isFetching}
              />
            ) : members.data.length === 0 ? (
              <EmptyState
                icon={<Users />}
                title="No members found"
                description="Try a different name, email or role."
              />
            ) : (
              <div className={cn('transition-opacity', members.isPlaceholderData && 'opacity-60')}>
                <MembersTable
                  organizationId={organization.id}
                  members={members.data}
                  actorRole={actorRole}
                  currentUserId={currentUser?.id}
                  onRemove={setToRemove}
                />
              </div>
            )}
          </>
        )}
      </TabPanel>

      <InviteMembersModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <ConfirmDialog
        open={toRemove !== null}
        onClose={() => setToRemove(null)}
        title="Remove member?"
        description={
          toRemove
            ? `${toRemove.user.name} will lose access to ${organization.name} and all of its projects. Their tasks will remain but become unassigned.`
            : undefined
        }
        confirmLabel="Remove member"
        loading={removeMember.isPending}
        onConfirm={() => {
          if (!toRemove) return;
          removeMember.mutate(toRemove.id, {
            onSuccess: () => {
              toast.success(`${toRemove.user.name} was removed`);
              setToRemove(null);
            },
          });
        }}
      />
    </div>
  );
}
