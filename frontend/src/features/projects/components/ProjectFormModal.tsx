import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ChangeEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useCurrentUser } from '@/features/auth/api/auth.queries';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { useMembers } from '@/features/team/api/team.queries';
import { applyFormError } from '@/lib/form';
import { paths } from '@/routes/paths';
import { toast } from '@/store/toast.store';
import { PROJECT_STATUSES, type Project } from '@/types';
import { suggestProjectKey } from '@/utils/string';

import { useCreateProject, useUpdateProject } from '../api/projects.queries';
import { PROJECT_STATUS_META } from '../constants';
import { projectFormSchema, type ProjectFormValues } from '../schemas';
import { MemberMultiPicker } from './MemberMultiPicker';

interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided the modal edits this project; otherwise it creates one. */
  project?: Project;
}

const FORM_ID = 'project-form';

const STATUS_OPTIONS = PROJECT_STATUSES.map((status) => ({
  value: status,
  label: PROJECT_STATUS_META[status].label,
}));

export function ProjectFormModal({ open, onClose, project }: ProjectFormModalProps) {
  const [pending, setPending] = useState(false);
  const editing = Boolean(project);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit project' : 'New project'}
      description={editing ? undefined : 'Projects group related tasks, people and timelines.'}
      size="lg"
      preventClose={pending}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={pending}>
            {editing ? 'Save changes' : 'Create project'}
          </Button>
        </>
      }
    >
      <ProjectForm project={project} onClose={onClose} onPendingChange={setPending} />
    </Modal>
  );
}

function ProjectForm({
  project,
  onClose,
  onPendingChange,
}: {
  project?: Project;
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const navigate = useNavigate();
  const organization = useActiveOrganization();
  const members = useMembers(organization.id);
  const { data: currentUser } = useCurrentUser();
  const create = useCreateProject(organization.id);
  const update = useUpdateProject(project?.id ?? '');

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project?.name ?? '',
      key: project?.key ?? '',
      description: project?.description ?? '',
      status: project?.status ?? 'PLANNING',
      startDate: project?.startDate ?? '',
      dueDate: project?.dueDate ?? '',
      memberIds:
        project?.members.map((member) => member.id) ?? (currentUser ? [currentUser.id] : []),
    },
  });
  const { errors, dirtyFields } = form.formState;

  const nameField = form.register('name', {
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      if (!project && !dirtyFields.key) {
        form.setValue('key', suggestProjectKey(event.target.value));
      }
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const input = {
      name: values.name,
      key: values.key,
      description: values.description || null,
      status: values.status,
      startDate: values.startDate || null,
      dueDate: values.dueDate || null,
      memberIds: values.memberIds,
    };
    onPendingChange(true);
    try {
      if (project) {
        await update.mutateAsync(input);
        toast.success('Project updated');
        onClose();
      } else {
        const created = await create.mutateAsync(input);
        toast.success(`${created.name} created`);
        onClose();
        void navigate(paths.projectBoard(created.id));
      }
    } catch (error) {
      applyFormError(error, form.setError);
    } finally {
      onPendingChange(false);
    }
  });

  return (
    <form id={FORM_ID} onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.root?.server && <Alert variant="danger">{errors.root.server.message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <FormField label="Project name" error={errors.name?.message} required>
          <Input autoFocus placeholder="Website redesign" {...nameField} />
        </FormField>
        <FormField
          label="Key"
          error={errors.key?.message}
          hint={project ? 'Keys can’t be changed.' : 'Prefix for task IDs'}
          required
        >
          <Input
            placeholder="WEB"
            maxLength={6}
            disabled={Boolean(project)}
            className="uppercase"
            autoComplete="off"
            {...form.register('key')}
          />
        </FormField>
      </div>

      <FormField label="Description" error={errors.description?.message}>
        <Textarea
          rows={3}
          placeholder="What is this project about?"
          {...form.register('description')}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Status" error={errors.status?.message}>
          <Select options={STATUS_OPTIONS} {...form.register('status')} />
        </FormField>
        <FormField label="Start date" error={errors.startDate?.message}>
          <Input type="date" {...form.register('startDate')} />
        </FormField>
        <FormField label="Due date" error={errors.dueDate?.message}>
          <Input type="date" {...form.register('dueDate')} />
        </FormField>
      </div>

      <FormField label="Members" error={errors.memberIds?.message}>
        <Controller
          control={form.control}
          name="memberIds"
          render={({ field }) => (
            <MemberMultiPicker
              members={members.data ?? []}
              isLoading={members.isPending}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </FormField>

      <button type="submit" hidden />
    </form>
  );
}
