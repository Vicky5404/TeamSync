import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import {
  useDeleteOrganization,
  useLeaveOrganization,
  useUpdateOrganization,
} from '@/features/organizations/api/organizations.queries';
import {
  useActiveOrganization,
  usePermissions,
} from '@/features/organizations/active-organization';
import {
  updateOrganizationSchema,
  type UpdateOrganizationValues,
} from '@/features/organizations/schemas';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { applyFormError } from '@/lib/form';
import { ROLE_LABELS } from '@/lib/permissions';
import { paths } from '@/routes/paths';
import { toast } from '@/store/toast.store';
import type { Organization } from '@/types';
import { formatLongDate } from '@/utils/date';

import { SettingsSection } from '../components/SettingsSection';

export function OrganizationSettingsPage() {
  useDocumentTitle('Organization settings');
  const organization = useActiveOrganization();
  const { can, role } = usePermissions();

  return (
    <>
      {/* Keyed so the form resets when switching organizations. */}
      <OrganizationForm
        key={organization.id}
        organization={organization}
        canEdit={can('organization:update')}
      />
      <SettingsSection title="Your membership">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium">{ROLE_LABELS[role]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Members</dt>
            <dd className="font-medium">{organization.memberCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="font-medium">{formatLongDate(organization.createdAt)}</dd>
          </div>
        </dl>
      </SettingsSection>
      <DangerZone organization={organization} isOwner={can('organization:delete')} />
    </>
  );
}

function OrganizationForm({
  organization,
  canEdit,
}: {
  organization: Organization;
  canEdit: boolean;
}) {
  const update = useUpdateOrganization(organization.id);
  const form = useForm<UpdateOrganizationValues>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: {
      name: organization.name,
      slug: organization.slug,
      description: organization.description ?? '',
    },
  });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    update.mutate(
      { name: values.name, slug: values.slug, description: values.description || null },
      {
        onSuccess: (updated) => {
          form.reset({
            name: updated.name,
            slug: updated.slug,
            description: updated.description ?? '',
          });
          toast.success('Organization updated');
        },
        onError: (error) => applyFormError(error, form.setError),
      },
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsSection
        title="General"
        description="Basic information about your organization."
        footer={
          canEdit ? (
            <>
              <Button
                variant="ghost"
                onClick={() => form.reset()}
                disabled={!isDirty || update.isPending}
              >
                Discard
              </Button>
              <Button type="submit" loading={update.isPending} disabled={!isDirty}>
                Save changes
              </Button>
            </>
          ) : undefined
        }
      >
        <fieldset disabled={!canEdit} className="space-y-4">
          {!canEdit && (
            <Alert variant="info">Only owners and admins can change organization settings.</Alert>
          )}
          {errors.root?.server && <Alert variant="danger">{errors.root.server.message}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Organization name" error={errors.name?.message} required>
              <Input {...form.register('name')} />
            </FormField>
            <FormField label="URL slug" error={errors.slug?.message} required>
              <Input spellCheck={false} {...form.register('slug')} />
            </FormField>
          </div>
          <FormField label="Description" error={errors.description?.message}>
            <Textarea
              rows={3}
              placeholder="What does your organization do?"
              {...form.register('description')}
            />
          </FormField>
        </fieldset>
      </SettingsSection>
    </form>
  );
}

function DangerZone({ organization, isOwner }: { organization: Organization; isOwner: boolean }) {
  const navigate = useNavigate();
  const deleteOrganization = useDeleteOrganization();
  const leaveOrganization = useLeaveOrganization();
  const [confirm, setConfirm] = useState<'delete' | 'leave' | null>(null);

  const done = (message: string) => {
    toast.success(message);
    setConfirm(null);
    void navigate(paths.dashboard, { replace: true });
  };

  return (
    <SettingsSection
      title="Danger zone"
      tone="danger"
      description={
        isOwner
          ? 'Deleting the organization permanently removes all projects, tasks and files.'
          : 'Leaving removes your access to all projects in this organization.'
      }
    >
      {isOwner ? (
        <Button variant="destructive" onClick={() => setConfirm('delete')}>
          Delete organization
        </Button>
      ) : (
        <Button variant="outline" className="text-destructive" onClick={() => setConfirm('leave')}>
          Leave organization
        </Button>
      )}

      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title={`Delete ${organization.name}?`}
        description="This permanently deletes the organization, its projects, tasks, comments and files for every member. This cannot be undone."
        confirmLabel="Delete organization"
        confirmationText={organization.slug}
        loading={deleteOrganization.isPending}
        onConfirm={() =>
          deleteOrganization.mutate(organization.id, {
            onSuccess: () => done(`${organization.name} was deleted`),
          })
        }
      />
      <ConfirmDialog
        open={confirm === 'leave'}
        onClose={() => setConfirm(null)}
        title={`Leave ${organization.name}?`}
        description="You'll lose access immediately. An admin will need to invite you again to rejoin."
        confirmLabel="Leave organization"
        loading={leaveOrganization.isPending}
        onConfirm={() =>
          leaveOrganization.mutate(organization.id, {
            onSuccess: () => done(`You left ${organization.name}`),
          })
        }
      />
    </SettingsSection>
  );
}
