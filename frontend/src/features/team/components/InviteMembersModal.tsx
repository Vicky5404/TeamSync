import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { applyFormError } from '@/lib/form';
import { assignableRoles, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/permissions';
import { toast } from '@/store/toast.store';
import { cn } from '@/lib/cn';

import { useInviteMembers } from '../api/team.queries';
import { inviteSchema, parseEmailList, type InviteValues } from '../schemas';

const FORM_ID = 'invite-members-form';

interface InviteMembersModalProps {
  open: boolean;
  onClose: () => void;
}

export function InviteMembersModal({ open, onClose }: InviteMembersModalProps) {
  const [pending, setPending] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite members"
      description="Invitations are sent by email and expire after 7 days."
      size="md"
      preventClose={pending}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={pending}>
            Send invitations
          </Button>
        </>
      }
    >
      <InviteForm onDone={onClose} onPendingChange={setPending} />
    </Modal>
  );
}

function InviteForm({
  onDone,
  onPendingChange,
}: {
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const organization = useActiveOrganization();
  const invite = useInviteMembers(organization.id);
  const roles = assignableRoles(organization.role);

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      emails: '',
      role: roles.includes('MEMBER') ? 'MEMBER' : (roles[0] ?? 'VIEWER'),
      message: '',
    },
  });
  const { errors } = form.formState;
  const selectedRole = useWatch({ control: form.control, name: 'role' });
  const emailsValue = useWatch({ control: form.control, name: 'emails' });
  const emailCount = parseEmailList(emailsValue).length;

  const onSubmit = form.handleSubmit(async (values) => {
    onPendingChange(true);
    try {
      const result = await invite.mutateAsync({
        emails: parseEmailList(values.emails),
        role: values.role,
        message: values.message || null,
      });
      if (result.invited.length > 0) {
        toast.success(
          `${result.invited.length} invitation${result.invited.length === 1 ? '' : 's'} sent`,
        );
      }
      if (result.skipped.length > 0) {
        toast.warning(`${result.skipped.length} skipped`, {
          description: result.skipped.map((item) => `${item.email}: ${item.reason}`).join('\n'),
        });
      }
      onDone();
    } catch (error) {
      applyFormError(error, form.setError);
    } finally {
      onPendingChange(false);
    }
  });

  return (
    <form id={FORM_ID} onSubmit={onSubmit} noValidate className="space-y-5">
      {errors.root?.server && <Alert variant="danger">{errors.root.server.message}</Alert>}

      <FormField
        label="Email addresses"
        error={errors.emails?.message}
        hint={
          emailCount > 0
            ? `${emailCount} recipient${emailCount === 1 ? '' : 's'}`
            : 'Separate multiple emails with commas or new lines.'
        }
        required
      >
        <Textarea
          autoFocus
          rows={3}
          placeholder="jane@company.com, john@company.com"
          {...form.register('emails')}
        />
      </FormField>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium">Role</legend>
        {roles.map((role) => (
          <label
            key={role}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent/50',
              selectedRole === role && 'border-primary bg-primary-soft/40',
            )}
          >
            <input
              type="radio"
              value={role}
              className="mt-0.5 size-4 accent-primary"
              {...form.register('role')}
            />
            <span>
              <span className="block text-sm font-medium">{ROLE_LABELS[role]}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <FormField
        label="Personal message"
        error={errors.message?.message}
        hint="Optional — included in the invitation email."
      >
        <Textarea rows={2} {...form.register('message')} />
      </FormField>

      <button type="submit" hidden />
    </form>
  );
}
