import { LogOut, Monitor, Moon, Settings, Sun, UserRound } from 'lucide-react';

import { Avatar } from '@/components/ui/Avatar';
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownLinkItem,
  DropdownRadioItem,
  DropdownSeparator,
} from '@/components/ui/Dropdown';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCurrentUser, useLogout } from '@/features/auth/api/auth.queries';
import { paths } from '@/routes/paths';
import { useUiStore, type ThemePreference } from '@/store/ui.store';

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function UserMenu() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);

  if (!user) return <Skeleton className="size-8 rounded-full" />;

  return (
    <Dropdown
      label="Account"
      placement="bottom-end"
      className="w-64"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={`Account menu for ${user.name}`}
          className="rounded-full outline-offset-2"
        >
          <Avatar name={user.name} src={user.avatarUrl} size="md" decorative />
        </button>
      )}
    >
      <div className="flex items-center gap-3 px-2.5 py-2">
        <Avatar name={user.name} src={user.avatarUrl} size="md" decorative />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <DropdownSeparator />
      <DropdownLinkItem to={paths.settingsProfile} icon={<UserRound />}>
        Profile
      </DropdownLinkItem>
      <DropdownLinkItem to={paths.settings} icon={<Settings />}>
        Settings
      </DropdownLinkItem>
      <DropdownSeparator />
      <DropdownLabel>Theme</DropdownLabel>
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
        <DropdownRadioItem
          key={value}
          checked={theme === value}
          onSelect={() => setTheme(value)}
          icon={<Icon />}
        >
          {label}
        </DropdownRadioItem>
      ))}
      <DropdownSeparator />
      <DropdownItem icon={<LogOut />} onSelect={() => logout.mutate()} disabled={logout.isPending}>
        Sign out
      </DropdownItem>
    </Dropdown>
  );
}
