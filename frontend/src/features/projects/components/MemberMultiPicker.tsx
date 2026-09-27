import { ChevronDown, Users } from 'lucide-react';

import { AvatarGroup, Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dropdown, DropdownCheckboxItem, DropdownLabel } from '@/components/ui/Dropdown';
import type { Member } from '@/types';

interface MemberMultiPickerProps {
  members: readonly Member[];
  value: readonly string[];
  onChange: (userIds: string[]) => void;
  isLoading?: boolean;
  id?: string;
}

/** Choose project members from the organization's members (by user id). */
export function MemberMultiPicker({
  members,
  value,
  onChange,
  isLoading = false,
  id,
}: MemberMultiPickerProps) {
  const selected = members.filter((member) => value.includes(member.user.id));

  return (
    <Dropdown
      label="Project members"
      placement="bottom-start"
      className="max-h-80 w-72"
      trigger={(props) => (
        <Button
          {...props}
          id={id}
          variant="outline"
          disabled={isLoading}
          className="h-auto min-h-9 w-full justify-start py-1.5 font-normal"
        >
          {selected.length > 0 ? (
            <>
              <AvatarGroup users={selected.map((member) => member.user)} max={5} size="xs" />
              <span className="text-sm">
                {selected.length} member{selected.length === 1 ? '' : 's'}
              </span>
            </>
          ) : (
            <>
              <Users className="text-muted-foreground" />
              <span className="text-muted-foreground">
                {isLoading ? 'Loading members…' : 'Select members'}
              </span>
            </>
          )}
          <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
        </Button>
      )}
    >
      <DropdownLabel>Organization members</DropdownLabel>
      {members.map((member) => (
        <DropdownCheckboxItem
          key={member.id}
          checked={value.includes(member.user.id)}
          onCheckedChange={(checked) =>
            onChange(
              checked
                ? [...value, member.user.id]
                : value.filter((userId) => userId !== member.user.id),
            )
          }
          icon={<Avatar name={member.user.name} src={member.user.avatarUrl} size="xs" decorative />}
        >
          {member.user.name}
        </DropdownCheckboxItem>
      ))}
    </Dropdown>
  );
}
