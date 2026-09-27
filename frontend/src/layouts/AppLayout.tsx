import { Outlet } from 'react-router';

import { registerCommentRealtime } from '@/features/comments/realtime';
import { registerNotificationRealtime } from '@/features/notifications/realtime';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { OrganizationGate } from '@/features/organizations/components/OrganizationGate';
import { GlobalSearch } from '@/features/search/components/GlobalSearch';
import { registerTaskRealtime } from '@/features/tasks/realtime';
import { registerTeamRealtime } from '@/features/team/realtime';
import { env } from '@/lib/env';
import { RealtimeProvider, type RealtimeRegistration } from '@/lib/realtime/RealtimeProvider';

import { MobileNav } from './components/MobileNav';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';

/** Stable list of real-time event handlers (module scope = stable reference). */
const REALTIME_REGISTRATIONS: readonly RealtimeRegistration[] = [
  registerNotificationRealtime,
  registerTaskRealtime,
  registerCommentRealtime,
  registerTeamRealtime,
];

/** Authenticated application shell. */
export function AppLayout() {
  return (
    <OrganizationGate>
      <AppShell />
    </OrganizationGate>
  );
}

function AppShell() {
  const organization = useActiveOrganization();

  return (
    <RealtimeProvider
      url={env.wsUrl}
      channel={`organization:${organization.id}`}
      registrations={REALTIME_REGISTRATIONS}
    >
      <a
        href="#main-content"
        className="sr-only z-[80] rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <div className="flex min-h-dvh">
        <Sidebar />
        <MobileNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
          >
            <Outlet />
          </main>
        </div>
      </div>
      <GlobalSearch />
    </RealtimeProvider>
  );
}
