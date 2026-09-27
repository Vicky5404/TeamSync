import { Bell, Building, Palette, ShieldCheck, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

import { PageHeader } from '@/components/common/PageHeader';
import { cn } from '@/lib/cn';
import { paths } from '@/routes/paths';

const NAV_ITEMS = [
  { to: paths.settingsProfile, label: 'Profile', icon: UserRound },
  { to: paths.settingsOrganization, label: 'Organization', icon: Building },
  { to: paths.settingsNotifications, label: 'Notifications', icon: Bell },
  { to: paths.settingsSecurity, label: 'Security', icon: ShieldCheck },
  { to: paths.settingsAppearance, label: 'Appearance', icon: Palette },
] as const;

export function SettingsLayout() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account and organization preferences."
      />
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <nav aria-label="Settings sections" className="lg:w-56 lg:shrink-0">
          <ul className="relative -mx-4 flex scrollbar-thin gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                      isActive && 'bg-accent text-foreground',
                    )
                  }
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1 space-y-6 lg:max-w-3xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
