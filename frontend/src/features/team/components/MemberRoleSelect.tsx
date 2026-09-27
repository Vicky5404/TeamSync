import { Select } from '@/components/ui/Select';
import { assignableRoles, canManageMember, ROLE_LABELS } from '@/lib/permissions';
import { toast } from '@/store/toast.store';
import type { Member, Role } from '@/types';

import { useUpdateMemberRole } from '../api/team.queries';
import { RoleBadge } from './RoleBadge';

interface MemberRoleSelectProps {
  organizationId: string;
  member: Member;
  actorRole: Role;
  isSelf: boolean;
}

/** Inline role editor; falls back to a read-only badge when not permitted. */
export function MemberRoleSelect({
  organizationId,
  member,
  actorRole,
  isSelf,
}: MemberRoleSelectProps) {
  const updateRole = useUpdateMemberRole(organizationId);

  if (isSelf || !canManageMember(actorRole, member.role)) {
    return <RoleBadge role={member.role} />;
  }

  const options = assignableRoles(actorRole).map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  }));

  return (
    <div className="w-36">
      <Select
        size="sm"
        aria-label={`Role for ${member.user.name}`}
        value={member.role}
        options={options}
        disabled={updateRole.isPending}
        onChange={(event) => {
          const role = event.target.value as Role;
          updateRole.mutate(
            { memberId: member.id, role },
            {
              onSuccess: () =>
                toast.success(`${member.user.name}'s role changed to ${ROLE_LABELS[role]}`),
            },
          );
        }}
      />
    </div>
  );
}
