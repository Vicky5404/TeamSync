import { zodResolver } from '@hookform/resolvers/zod';
import { Laptop, LogOut, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormField } from '@/components/ui/FormField';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { PasswordStrengthMeter } from '@/features/auth/components/PasswordStrengthMeter';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { applyFormError } from '@/lib/form';
import { toast } from '@/store/toast.store';
import type { UserSession } from '@/types';
import { formatRelativeTime } from '@/utils/date';

import {
  useChangePassword,
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
} from '../api/settings.queries';
import { SettingsSection } from '../components/SettingsSection';
import { changePasswordSchema, type ChangePasswordValues } from '../schemas';

export function SecuritySettingsPage() {
  useDocumentTitle('Security settings');
  return (
    <>
      <ChangePasswordForm />
      <SessionsSection />
    </>
  );
}

function ChangePasswordForm() {
  const changePassword = useChangePassword();
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const { errors } = form.formState;
  const newPassword = useWatch({ control: form.control, name: 'newPassword' });

  const onSubmit = form.handleSubmit(({ currentPassword, newPassword: next }) =>
    changePassword.mutate(
      { currentPassword, newPassword: next },
      {
        onSuccess: () => {
          form.reset();
          toast.success('Password changed', {
            description: 'Other sessions have been signed out.',
          });
        },
        onError: (error) => applyFormError(error, form.setError),
      },
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsSection
        title="Change password"
        description="Use a strong password you don't use anywhere else."
        footer={
          <Button type="submit" loading={changePassword.isPending}>
            Update password
          </Button>
        }
      >
        <div className="max-w-md space-y-4">
          {errors.root?.server && <Alert variant="danger">{errors.root.server.message}</Alert>}
          <FormField label="Current password" error={errors.currentPassword?.message} required>
            <PasswordInput autoComplete="current-password" {...form.register('currentPassword')} />
          </FormField>
          <FormField label="New password" error={errors.newPassword?.message} required>
            <PasswordInput autoComplete="new-password" {...form.register('newPassword')} />
          </FormField>
          <PasswordStrengthMeter password={newPassword} />
          <FormField label="Confirm new password" error={errors.confirmPassword?.message} required>
            <PasswordInput autoComplete="new-password" {...form.register('confirmPassword')} />
          </FormField>
        </div>
      </SettingsSection>
    </form>
  );
}

function SessionsSection() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [confirmOthers, setConfirmOthers] = useState(false);
  const others = sessions.data?.filter((session) => !session.current) ?? [];

  return (
    <SettingsSection
      title="Active sessions"
      description="Devices currently signed in to your account. Revoke any you don't recognize."
      footer={
        others.length > 0 ? (
          <Button variant="outline" leftIcon={<LogOut />} onClick={() => setConfirmOthers(true)}>
            Sign out all other sessions
          </Button>
        ) : undefined
      }
    >
      {sessions.isPending ? (
        <SkeletonGroup label="Loading sessions" className="space-y-3">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-14 w-full" />
          ))}
        </SkeletonGroup>
      ) : sessions.isError ? (
        <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} size="sm" />
      ) : (
        <ul className="divide-y">
          {sessions.data.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              revoking={revoke.isPending && revoke.variables === session.id}
              onRevoke={() =>
                revoke.mutate(session.id, { onSuccess: () => toast.success('Session revoked') })
              }
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmOthers}
        onClose={() => setConfirmOthers(false)}
        title="Sign out other sessions?"
        description={`This signs you out on ${others.length} other device${others.length === 1 ? '' : 's'}.`}
        confirmLabel="Sign out others"
        loading={revokeOthers.isPending}
        onConfirm={() =>
          revokeOthers.mutate(undefined, {
            onSuccess: () => {
              toast.success('Signed out of other sessions');
              setConfirmOthers(false);
            },
          })
        }
      />
    </SettingsSection>
  );
}

function SessionRow({
  session,
  revoking,
  onRevoke,
}: {
  session: UserSession;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const Icon = /iphone|android|mobile|ipad/i.test(session.device) ? Smartphone : Laptop;
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground"
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {session.browser} on {session.os}
          {session.current && <Badge variant="success">This device</Badge>}
        </p>
        <p className="text-xs text-muted-foreground">
          {[session.location, session.ipAddress].filter(Boolean).join(' · ')} ·{' '}
          {session.current
            ? 'Active now'
            : `Last active ${formatRelativeTime(session.lastActiveAt)}`}
        </p>
      </div>
      {!session.current && (
        <Button variant="ghost" size="sm" onClick={onRevoke} loading={revoking}>
          Revoke
        </Button>
      )}
    </li>
  );
}
