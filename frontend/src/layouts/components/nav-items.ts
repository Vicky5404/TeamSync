import {
  Bell,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { paths } from '@/routes/paths';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Shows the unread notification count. */
  badge?: 'notifications';
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { label: 'Dashboard', to: paths.dashboard, icon: LayoutDashboard },
  { label: 'Projects', to: paths.projects, icon: FolderKanban },
  { label: 'My tasks', to: paths.myTasks, icon: ListTodo },
  { label: 'Team', to: paths.team, icon: Users },
  { label: 'Notifications', to: paths.notifications, icon: Bell, badge: 'notifications' },
  { label: 'Settings', to: paths.settings, icon: Settings },
];
