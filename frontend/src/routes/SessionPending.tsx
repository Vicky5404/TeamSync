import { FullPageLoader } from '@/components/common/FullPageLoader';
import { Logo } from '@/components/common/Logo';
import { ErrorState } from '@/components/ui/ErrorState';
import { useAuthStore } from '@/store/auth.store';

/**
 * Shown by the route guards while the session is being restored. If the API
 * can't be reached, explains why instead of spinning forever (restoring keeps
 * retrying in the background).
 */
export function SessionPending() {
  const restoreError = useAuthStore((state) => state.restoreError);
  if (!restoreError) return <FullPageLoader />;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-4">
      <Logo />
      <ErrorState
        title="Can't reach FlowSync"
        message={`${restoreError} Retrying automatically…`}
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}
