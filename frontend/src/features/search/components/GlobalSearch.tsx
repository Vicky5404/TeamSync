import {
  CornerDownLeft,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';

import { Avatar } from '@/components/ui/Avatar';
import { Kbd } from '@/components/ui/Kbd';
import { Spinner } from '@/components/ui/Spinner';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { TaskStatusIcon } from '@/features/tasks/components/TaskBadges';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { MOD_KEY_LABEL, useHotkey } from '@/hooks/useHotkey';
import { useOverlay } from '@/hooks/useOverlay';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/http';
import { paths } from '@/routes/paths';
import { useUiStore } from '@/store/ui.store';

import { MIN_SEARCH_LENGTH, useGlobalSearch } from '../api/search.queries';

interface ResultItem {
  id: string;
  group: string;
  label: string;
  description?: string;
  href: string;
  icon: ReactNode;
}

const QUICK_LINKS: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: 'Dashboard', href: paths.dashboard, icon: LayoutDashboard },
  { label: 'Projects', href: paths.projects, icon: FolderKanban },
  { label: 'My tasks', href: paths.myTasks, icon: ListTodo },
  { label: 'Team', href: paths.team, icon: Users },
  { label: 'Settings', href: paths.settingsProfile, icon: Settings },
];

/** Global command palette (⌘K / Ctrl+K, or "/"). */
export function GlobalSearch() {
  const open = useUiStore((state) => state.searchOpen);
  const setOpen = useUiStore((state) => state.setSearchOpen);

  useHotkey('mod+k', () => setOpen(!useUiStore.getState().searchOpen), { allowInInputs: true });
  useHotkey('/', () => setOpen(true));

  if (!open) return null;
  return createPortal(<SearchDialog onClose={() => setOpen(false)} />, document.body);
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const organization = useActiveOrganization();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const debounced = useDebouncedValue(query, 200);
  const search = useGlobalSearch(organization.id, debounced);

  useOverlay({ open: true, onClose, containerRef: panelRef, initialFocusRef: inputRef });

  const searching = query.trim().length >= MIN_SEARCH_LENGTH;

  const items = useMemo<ResultItem[]>(() => {
    if (!searching) {
      return QUICK_LINKS.map(({ label, href, icon: Icon }) => ({
        id: `nav-${href}`,
        group: 'Go to',
        label,
        href,
        icon: <Icon className="size-4 text-muted-foreground" />,
      }));
    }
    const data = search.data;
    if (!data) return [];
    return [
      ...data.projects.map((project) => ({
        id: `project-${project.id}`,
        group: 'Projects',
        label: project.name,
        description: project.key,
        href: paths.projectBoard(project.id),
        icon: <FolderKanban className="size-4 text-muted-foreground" />,
      })),
      ...data.tasks.map((task) => ({
        id: `task-${task.id}`,
        group: 'Tasks',
        label: task.title,
        description: `${task.identifier} · ${task.projectName}`,
        href: paths.task(task.projectId, task.id),
        icon: <TaskStatusIcon status={task.status} />,
      })),
      ...data.members.map((member) => ({
        id: `member-${member.id}`,
        group: 'People',
        label: member.name,
        description: member.email,
        href: paths.member(member.id),
        icon: <Avatar name={member.name} src={member.avatarUrl} size="xs" decorative />,
      })),
    ];
  }, [searching, search.data]);

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );
  const active = items[activeIndex];

  const select = (item: ResultItem | undefined) => {
    if (!item) return;
    onClose();
    void navigate(item.href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (items.length === 0) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = items[(activeIndex + delta + items.length) % items.length];
      if (next) {
        setActiveId(next.id);
        document.getElementById(`${listboxId}-${next.id}`)?.scrollIntoView({ block: 'nearest' });
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      select(active);
    }
  };

  const groups = items.reduce<Array<{ name: string; items: ResultItem[] }>>((acc, item) => {
    const group = acc.find((entry) => entry.name === item.group);
    if (group) group.items.push(item);
    else acc.push({ name: item.group, items: [item] });
    return acc;
  }, []);

  const status = !searching
    ? null
    : search.isError
      ? getErrorMessage(search.error)
      : search.isFetching && !search.data
        ? 'Searching…'
        : search.data && items.length === 0
          ? `No results for “${debounced.trim()}”`
          : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
      <div
        aria-hidden="true"
        className="fixed inset-0 animate-fade-in bg-overlay"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative flex max-h-[70vh] w-full max-w-xl animate-pop-in flex-col overflow-hidden rounded-xl border bg-surface-raised shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b px-4">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={active ? `${listboxId}-${active.id}` : undefined}
            aria-autocomplete="list"
            aria-label="Search projects, tasks and people"
            placeholder="Search projects, tasks and people…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveId(null);
            }}
            onKeyDown={onKeyDown}
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {search.isFetching && searching && <Spinner className="text-muted-foreground" />}
          <Kbd>Esc</Kbd>
        </div>

        <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto p-2">
          {status && (
            <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">
              {status}
            </p>
          )}
          <ul id={listboxId} role="listbox" aria-label="Search results">
            {groups.map((group) => (
              <li key={group.name} role="presentation">
                <p className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                  {group.name}
                </p>
                <ul role="group" aria-label={group.name}>
                  {group.items.map((item) => {
                    const isActive = item.id === active?.id;
                    return (
                      <li
                        key={item.id}
                        id={`${listboxId}-${item.id}`}
                        role="option"
                        aria-selected={isActive}
                        onMouseMove={() => setActiveId(item.id)}
                        onClick={() => select(item)}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm',
                          isActive && 'bg-accent',
                        )}
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center">
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          )}
                        </span>
                        {isActive && (
                          <CornerDownLeft
                            aria-hidden="true"
                            className="size-4 text-muted-foreground"
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground sm:flex">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Enter</Kbd> to open
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Kbd>{MOD_KEY_LABEL}</Kbd>
            <Kbd>K</Kbd> to toggle
          </span>
        </div>
      </div>
    </div>
  );
}
