import { EllipsisVertical, UserMinus, UserRound } from 'lucide-react';
import { Link } from 'react-router';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dropdown, DropdownItem, DropdownLinkItem } from '@/components/ui/Dropdown';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { canManageMember } from '@/lib/permissions';
import { paths } from '@/routes/paths';
import type { Member, Role } from '@/types';
import { formatDate, formatRelativeTime } from '@/utils/date';

import { MemberRoleSelect } from './MemberRoleSelect';
import { RoleBadge } from './RoleBadge';

interface MembersTableProps {
  organizationId: string;
  members: readonly Member[];
  actorRole: Role;
  currentUserId: string | undefined;
  onRemove: (member: Member) => void;
}

export function MembersTable({
  organizationId,
  members,
  actorRole,
  currentUserId,
  onRemove,
}: MembersTableProps) {
  const actions = (member: Member) => {
    const isSelf = member.user.id === currentUserId;
    const canRemove = !isSelf && canManageMember(actorRole, member.role);
    return (
      <Dropdown
        label={`Actions for ${member.user.name}`}
        trigger={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${member.user.name}`}
          >
            <EllipsisVertical />
          </Button>
        )}
      >
        <DropdownLinkItem to={paths.member(member.id)} icon={<UserRound />}>
          View profile
        </DropdownLinkItem>
        {canRemove && (
          <DropdownItem icon={<UserMinus />} destructive onSelect={() => onRemove(member)}>
            Remove from organization
          </DropdownItem>
        )}
      </Dropdown>
    );
  };

  const identity = (member: Member) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={member.user.name} src={member.user.avatarUrl} size="md" decorative />
      <div className="min-w-0">
        <Link
          to={paths.member(member.id)}
          className="block truncate text-sm font-medium text-foreground hover:underline"
        >
          {member.user.name}
          {member.user.id === currentUserId && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>
          )}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
      </div>
    </div>
  );

  return (
    <>
      <Table containerClassName="hidden md:block">
        <caption className="sr-only">Organization members</caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Member</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Last active</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>{identity(member)}</TableCell>
              <TableCell className="text-muted-foreground">{member.user.jobTitle ?? '—'}</TableCell>
              <TableCell>
                <MemberRoleSelect
                  organizationId={organizationId}
                  member={member}
                  actorRole={actorRole}
                  isSelf={member.user.id === currentUserId}
                />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDate(member.joinedAt)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {member.lastActiveAt ? formatRelativeTime(member.lastActiveAt) : 'Never'}
              </TableCell>
              <TableCell>{actions(member)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ul
        className="divide-y rounded-xl border bg-surface md:hidden"
        aria-label="Organization members"
      >
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              {identity(member)}
              <RoleBadge role={member.role} />
            </div>
            {actions(member)}
          </li>
        ))}
      </ul>
    </>
  );
}
