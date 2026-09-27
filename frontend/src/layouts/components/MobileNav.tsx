import { Logo } from '@/components/common/Logo';
import { Drawer } from '@/components/ui/Drawer';
import { useUiStore } from '@/store/ui.store';

import { SidebarContent } from './SidebarContent';

/** Off-canvas navigation for small screens (< lg). */
export function MobileNav() {
  const open = useUiStore((state) => state.mobileNavOpen);
  const setOpen = useUiStore((state) => state.setMobileNavOpen);
  const close = () => setOpen(false);

  return (
    <Drawer
      open={open}
      onClose={close}
      side="left"
      size="sm"
      title="Navigation"
      header={<Logo />}
      className="max-w-[18rem] sm:max-w-[18rem]"
    >
      <SidebarContent onNavigate={close} />
    </Drawer>
  );
}
