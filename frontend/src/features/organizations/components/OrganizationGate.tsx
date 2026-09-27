import { Building } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { FullPageLoader } from '@/components/common/FullPageLoader';
import { Logo } from '@/components/common/Logo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { useLogout } from '@/features/auth/api/auth.queries';
import { useOrganizationStore } from '@/store/organization.store';

import { ActiveOrganizationContext } from '../active-organization';
import { useOrganizations } from '../api/organizations.queries';
import { CreateOrganizationForm } from './CreateOrganizationForm';

/**
 * Resolves the active organization before rendering the app. Handles loading,
 * errors, first-run onboarding (no organizations) and stale selections.
 */
export function OrganizationGate({ children }: { children: ReactNode }) {
  const organizations = useOrganizations();
  const currentId = useOrganizationStore((state) => state.currentOrganizationId);
  const setCurrentId = useOrganizationStore((state) => state.setCurrentOrganizationId);

  const list = organizations.data;
  const active = list?.find((organization) => organization.id === currentId) ?? list?.[0] ?? null;

  // Persist the fallback selection when the stored id is missing or stale.
  useEffect(() => {
    if (active && active.id !== currentId) setCurrentId(active.id);
  }, [active, currentId, setCurrentId]);

  if (organizations.isPending) return <FullPageLoader label="Loading your workspace" />;

  if (organizations.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <ErrorState
          error={organizations.error}
          title="We couldn't load your workspace"
          onRetry={() => void organizations.refetch()}
          retrying={organizations.isFetching}
        />
      </div>
    );
  }

  if (!active) return <CreateFirstOrganization />;

  return (
    <ActiveOrganizationContext.Provider value={active}>
      {children}
    </ActiveOrganizationContext.Provider>
  );
}

function CreateFirstOrganization() {
  const logout = useLogout();
  const [pending, setPending] = useState(false);
  const formId = 'onboarding-organization-form';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background p-4">
      <Logo />
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 space-y-2">
          <div
            aria-hidden="true"
            className="mb-4 flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground"
          >
            <Building className="size-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Create your organization</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;re not part of any organization yet. Create one to start planning projects with
            your team — or ask a teammate to invite you.
          </p>
        </div>
        <CreateOrganizationForm
          formId={formId}
          onPendingChange={setPending}
          onCreated={() => undefined}
        />
        <div className="mt-6 flex flex-col gap-2">
          <Button type="submit" form={formId} loading={pending} className="w-full">
            Create organization
          </Button>
          <Button variant="ghost" onClick={() => logout.mutate()} loading={logout.isPending}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}
