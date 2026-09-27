import { Menu, Search } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { MOD_KEY_LABEL } from '@/hooks/useHotkey';
import { useUiStore } from '@/store/ui.store';

import { Breadcrumbs } from './Breadcrumbs';
import { UserMenu } from './UserMenu';

export function TopNav() {
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);
  const setSearchOpen = useUiStore((state) => state.setSearchOpen);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-surface/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/70 sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-2 lg:hidden"
        aria-label="Open navigation menu"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu />
      </Button>

      <Breadcrumbs className="flex-1" />

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          aria-keyshortcuts="Control+K Meta+K"
          className="hidden h-9 w-56 items-center gap-2 rounded-lg border border-input bg-surface px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent md:flex"
        >
          <Search aria-hidden="true" className="size-4" />
          <span className="flex-1 text-left">Search…</span>
          <span className="flex items-center gap-0.5" aria-hidden="true">
            <Kbd>{MOD_KEY_LABEL}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Search"
          onClick={() => setSearchOpen(true)}
        >
          <Search />
        </Button>
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
