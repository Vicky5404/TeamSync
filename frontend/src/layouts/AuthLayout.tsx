import { CircleCheck } from 'lucide-react';
import { Link, Outlet } from 'react-router';

import { Logo } from '@/components/common/Logo';
import { env } from '@/lib/env';
import { paths } from '@/routes/paths';
import { currentYear } from '@/utils/date';

const HIGHLIGHTS = [
  'Plan work on Kanban boards, lists and timelines',
  'Stay in sync with real-time updates and notifications',
  'Understand progress with dashboards and analytics',
  'Granular roles and permissions for every team',
];

/** Split layout for unauthenticated pages: form on the left, product panel on the right. */
export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <Link to={paths.root} className="self-start rounded-md">
          <Logo />
        </Link>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </main>
        <p className="text-center text-xs text-muted-foreground">
          © {currentYear()} {env.appName}. All rights reserved.
        </p>
      </div>

      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-center lg:px-16"
      >
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 size-80 rounded-full bg-white/5" />
        <div className="relative max-w-md space-y-8">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">
            Where teams plan, track and ship work together.
          </h2>
          <ul className="space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-primary-foreground/90">
                <CircleCheck className="mt-0.5 size-5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
