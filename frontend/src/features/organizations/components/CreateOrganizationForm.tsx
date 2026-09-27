import { zodResolver } from '@hookform/resolvers/zod';
import type { ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/Alert';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { applyFormError } from '@/lib/form';
import type { Organization } from '@/types';
import { slugify } from '@/utils/string';

import { useCreateOrganization } from '../api/organizations.queries';
import { createOrganizationSchema, type CreateOrganizationValues } from '../schemas';

interface CreateOrganizationFormProps {
  formId: string;
  onCreated: (organization: Organization) => void;
  onPendingChange?: (pending: boolean) => void;
}

/** Form body only — the caller renders the submit button with `form={formId}`. */
export function CreateOrganizationForm({
  formId,
  onCreated,
  onPendingChange,
}: CreateOrganizationFormProps) {
  const create = useCreateOrganization();
  const form = useForm<CreateOrganizationValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: '', slug: '' },
  });
  const { errors, dirtyFields } = form.formState;

  const nameField = form.register('name', {
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      // Suggest a slug until the user edits it manually.
      if (!dirtyFields.slug) {
        form.setValue('slug', slugify(event.target.value), { shouldValidate: false });
      }
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    onPendingChange?.(true);
    create.mutate(values, {
      onSuccess: onCreated,
      onError: (error) => applyFormError(error, form.setError),
      onSettled: () => onPendingChange?.(false),
    });
  });

  return (
    <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.root?.server && <Alert variant="danger">{errors.root.server.message}</Alert>}
      <FormField label="Organization name" error={errors.name?.message} required>
        <Input autoFocus placeholder="Acme Inc." autoComplete="organization" {...nameField} />
      </FormField>
      <FormField
        label="URL slug"
        error={errors.slug?.message}
        hint="Used in links and integrations. Lowercase letters, numbers and hyphens."
        required
      >
        <Input
          placeholder="acme"
          autoComplete="off"
          spellCheck={false}
          {...form.register('slug')}
        />
      </FormField>
    </form>
  );
}
