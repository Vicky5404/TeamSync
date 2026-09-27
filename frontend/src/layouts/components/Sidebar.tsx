import { Link } from 'react-router';

import { Logo } from '@/components/common/Logo';
import { cn } from '@/lib/cn';
import { paths } from '@/routes/paths';
import { useUiStore } from '@/store/ui.store';

import { SidebarContent } from './SidebarContent';

/** Persistent, collapsible desktop sidebar (≥ lg). */
export function Sidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-surface transition-[width] duration-200 lg:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div
        className={cn('flex h-14 items-center border-b px-4', collapsed && 'justify-center px-0')}
      >
        <Link to={paths.dashboard} aria-label="FlowSync home" className="rounded-md">
          <Logo compact={collapsed} />
        </Link>
      </div>
      <div className="min-h-0 flex-1">
        <SidebarContent collapsed={collapsed} onToggleCollapsed={toggleSidebar} />
      </div>
    </aside>
  );
}
