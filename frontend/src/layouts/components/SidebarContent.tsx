import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink } from 'react-router';

import { Tooltip } from '@/components/ui/Tooltip';
import { useUnreadCount } from '@/features/notifications/api/notifications.queries';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { useProjects } from '@/features/projects/api/projects.queries';
import { cn } from '@/lib/cn';
import { paths } from '@/routes/paths';

import { PRIMARY_NAV, type NavItem } from './nav-items';
import { OrganizationSwitcher } from './OrganizationSwitcher';

interface SidebarContentProps {
  collapsed?: boolean;
  /** Called after any navigation (closes the mobile drawer). */
  onNavigate?: () => void;
  onToggleCollapsed?: () => void;
}

export function SidebarContent({
  collapsed = false,
  onNavigate,
  onToggleCollapsed,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <OrganizationSwitcher collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <nav aria-label="Main" className="flex-1 scrollbar-thin overflow-y-auto px-3 pb-3">
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <li key={item.to}>
              <SidebarLink item={item} collapsed={collapsed} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        {!collapsed && <RecentProjects onNavigate={onNavigate} />}
      </nav>

      {onToggleCollapsed && (
        <div className="border-t p-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-4" />
            ) : (
              <>
                <PanelLeftClose aria-hidden="true" className="size-4" />
                Collapse
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function SidebarLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const unread = useUnreadCount();
  const count = item.badge === 'notifications' ? (unread.data ?? 0) : 0;
  const Icon = item.icon;

  const link = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      aria-label={collapsed ? (count ? `${item.label}, ${count} unread` : item.label) : undefined}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          isActive &&
            'bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft hover:text-primary-soft-foreground',
          collapsed && 'justify-center px-0',
        )
      }
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {count > 0 &&
        (collapsed ? (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-2.5 size-2 rounded-full bg-destructive"
          />
        ) : (
          <span className="rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground tabular-nums">
            {count > 99 ? '99+' : count}
            <span className="sr-only"> unread</span>
          </span>
        ))}
    </NavLink>
  );

  return collapsed ? (
    <Tooltip content={item.label} placement="bottom-start" className="w-full">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

function RecentProjects({ onNavigate }: { onNavigate?: () => void }) {
  const organization = useActiveOrganization();
  const projects = useProjects(organization.id, {
    sort: 'updated',
    pageSize: 5,
    status: ['ACTIVE', 'PLANNING'],
  });
  const items = projects.data?.data ?? [];
  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="px-2.5 pb-1.5 text-xs font-medium text-muted-foreground">Recent projects</p>
      <ul className="space-y-0.5">
        {items.map((project) => (
          <li key={project.id}>
            <NavLink
              to={paths.projectBoard(project.id)}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground',
                  isActive && 'bg-accent text-foreground',
                )
              }
            >
              <span className="flex h-5 min-w-8 items-center justify-center rounded bg-surface-muted px-1 text-[10px] font-semibold text-muted-foreground">
                {project.key}
              </span>
              <span className="truncate">{project.name}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
