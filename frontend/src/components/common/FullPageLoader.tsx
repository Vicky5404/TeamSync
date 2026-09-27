import { Spinner } from '@/components/ui/Spinner';

import { Logo } from './Logo';

export function FullPageLoader({ label = 'Loading FlowSync' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background">
      <Logo />
      <Spinner label={label} className="size-5 text-muted-foreground" />
    </div>
  );
}
