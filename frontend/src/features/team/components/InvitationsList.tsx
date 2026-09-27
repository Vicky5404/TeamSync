import { Mail, RotateCw, X } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';
import { toast } from '@/store/toast.store';
import type { Invitation } from '@/types';
import { formatDate, formatRelativeTime } from '@/utils/date';

import { useInvitations, useResendInvitation, useRevokeInvitation } from '../api/team.queries';
import { RoleBadge } from './RoleBadge';

export function InvitationsList({
  organizationId,
  canManage,
}: {
  organizationId: string;
  canManage: boolean;
}) {
  const invitations = useInvitations(organizationId);
  const resend = useResendInvitation(organizationId);
  const revoke = useRevokeInvitation(organizationId);
  const [toRevoke, setToRevoke] = useState<Invitation | null>(null);

  if (invitations.isPending) {
    return (
      <SkeletonGroup label="Loading invitations" className="space-y-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-14 w-full" />
        ))}
      </SkeletonGroup>
    );
  }

  if (invitations.isError) {
    return (
      <ErrorState
        error={invitations.error}
        onRetry={() => void invitations.refetch()}
        retrying={invitations.isFetching}
      />
    );
  }

  if (invitations.data.length === 0) {
    return (
      <EmptyState
        icon={<Mail />}
        title="No pending invitations"
        description="Invitations you send will appear here until they are accepted."
      />
    );
  }

  return (
    <>
      <ul className="divide-y rounded-xl border bg-surface">
        {invitations.data.map((invitation) => {
          const expired = invitation.status === 'EXPIRED';
          return (
            <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center rounded-full bg-surface-muted text-muted-foreground"
              >
                <Mail className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{invitation.email}</p>
                <p className="text-xs text-muted-foreground">
                  Invited by {invitation.invitedBy.name} {formatRelativeTime(invitation.createdAt)}{' '}
                  · {expired ? 'Expired' : `Expires ${formatDate(invitation.expiresAt)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {expired && <Badge variant="warning">Expired</Badge>}
                <RoleBadge role={invitation.role} />
                {canManage && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Resend invitation to ${invitation.email}`}
                      title="Resend"
                      disabled={resend.isPending && resend.variables === invitation.id}
                      onClick={() =>
                        resend.mutate(invitation.id, {
                          onSuccess: () =>
                            toast.success(`Invitation resent to ${invitation.email}`),
                        })
                      }
                    >
                      <RotateCw />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Revoke invitation for ${invitation.email}`}
                      title="Revoke"
                      onClick={() => setToRevoke(invitation)}
                    >
                      <X />
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={toRevoke !== null}
        onClose={() => setToRevoke(null)}
        title="Revoke invitation?"
        description={
          toRevoke
            ? `${toRevoke.email} will no longer be able to join with this invitation.`
            : undefined
        }
        confirmLabel="Revoke invitation"
        loading={revoke.isPending}
        onConfirm={() => {
          if (!toRevoke) return;
          revoke.mutate(toRevoke.id, {
            onSuccess: () => {
              toast.success('Invitation revoked');
              setToRevoke(null);
            },
          });
        }}
      />
    </>
  );
}
