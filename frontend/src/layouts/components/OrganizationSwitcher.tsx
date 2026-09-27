import { Building, ChevronsUpDown, Plus, Settings } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Avatar } from '@/components/ui/Avatar';
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownLinkItem,
  DropdownRadioItem,
  DropdownSeparator,
} from '@/components/ui/Dropdown';
import { Tooltip } from '@/components/ui/Tooltip';
import { useOrganizations } from '@/features/organizations/api/organizations.queries';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { CreateOrganizationModal } from '@/features/organizations/components/CreateOrganizationModal';
import { cn } from '@/lib/cn';
import { ROLE_LABELS } from '@/lib/permissions';
import { paths } from '@/routes/paths';
import { useOrganizationStore } from '@/store/organization.store';
import { toast } from '@/store/toast.store';

interface OrganizationSwitcherProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function OrganizationSwitcher({ collapsed = false, onNavigate }: OrganizationSwitcherProps) {
  const navigate = useNavigate();
  const active = useActiveOrganization();
  const organizations = useOrganizations();
  const setCurrentOrganizationId = useOrganizationStore((state) => state.setCurrentOrganizationId);
  const [createOpen, setCreateOpen] = useState(false);

  const switchTo = (organizationId: string, name: string) => {
    if (organizationId === active.id) return;
    setCurrentOrganizationId(organizationId);
    onNavigate?.();
    // Project/task URLs belong to the previous organization.
    void navigate(paths.dashboard);
    toast.success(`Switched to ${name}`);
  };

  return (
    <>
      <Dropdown
        label="Switch organization"
        placement="bottom-start"
        className="w-64"
        trigger={(props) => {
          const button = (
            <button
              {...props}
              type="button"
              aria-label={`Current organization: ${active.name}. Switch organization`}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-accent',
                collapsed && 'justify-center',
              )}
            >
              <Avatar name={active.name} src={active.logoUrl} size="md" shape="square" decorative />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{active.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {ROLE_LABELS[active.role]}
                    </span>
                  </span>
                  <ChevronsUpDown
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </>
              )}
            </button>
          );
          return collapsed ? (
            <Tooltip content={active.name} placement="bottom-start">
              {button}
            </Tooltip>
          ) : (
            button
          );
        }}
      >
        <DropdownLabel>Organizations</DropdownLabel>
        {organizations.data?.map((organization) => (
          <DropdownRadioItem
            key={organization.id}
            checked={organization.id === active.id}
            onSelect={() => switchTo(organization.id, organization.name)}
            icon={
              <Avatar
                name={organization.name}
                src={organization.logoUrl}
                size="xs"
                shape="square"
                decorative
              />
            }
          >
            {organization.name}
          </DropdownRadioItem>
        ))}
        <DropdownSeparator />
        <DropdownLinkItem to={paths.settingsOrganization} icon={<Settings />} onClick={onNavigate}>
          Organization settings
        </DropdownLinkItem>
        <DropdownItem icon={<Plus />} onSelect={() => setCreateOpen(true)}>
          Create organization
        </DropdownItem>
        {organizations.isError && (
          <p className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-destructive">
            <Building className="size-3.5" /> Couldn&apos;t refresh organizations
          </p>
        )}
      </Dropdown>
      <CreateOrganizationModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
