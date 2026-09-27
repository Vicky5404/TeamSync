import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useLabels } from '@/features/organizations/api/organizations.queries';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { applyFormError } from '@/lib/form';
import { toast } from '@/store/toast.store';
import { TASK_PRIORITIES, TASK_STATUSES, type TaskStatus, type UserSummary } from '@/types';

import { useCreateTask } from '../api/tasks.queries';
import { TASK_PRIORITY_META, TASK_STATUS_META } from '../constants';
import { taskFormSchema, type TaskFormValues } from '../schemas';
import { LabelPicker } from './TaskFieldPickers';

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** People that can be assigned (project members). */
  assignees: readonly UserSummary[];
  defaultStatus?: TaskStatus;
  onCreated?: (taskId: string) => void;
}

const FORM_ID = 'create-task-form';

const STATUS_OPTIONS = TASK_STATUSES.map((status) => ({
  value: status,
  label: TASK_STATUS_META[status].label,
}));

const PRIORITY_OPTIONS = TASK_PRIORITIES.map((priority) => ({
  value: priority,
  label: TASK_PRIORITY_META[priority].label,
}));

export function CreateTaskModal({ open, onClose, ...props }: CreateTaskModalProps) {
  const [pending, setPending] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New task"
      size="lg"
      preventClose={pending}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={pending}>
            Create task
          </Button>
        </>
      }
    >
      <CreateTaskForm {...props} onClose={onClose} onPendingChange={setPending} />
    </Modal>
  );
}

function CreateTaskForm({
  projectId,
  assignees,
  defaultStatus = 'TODO',
  onCreated,
  onClose,
  onPendingChange,
}: Omit<CreateTaskModalProps, 'open'> & { onPendingChange: (pending: boolean) => void }) {
  const organization = useActiveOrganization();
  const labels = useLabels(organization.id);
  const create = useCreateTask(projectId);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      status: defaultStatus,
      priority: 'MEDIUM',
      assigneeId: '',
      dueDate: '',
      labelIds: [],
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    onPendingChange(true);
    try {
      const task = await create.mutateAsync({
        title: values.title,
        description: values.description || null,
        status: values.status,
        priority: values.priority,
        assigneeId: values.assigneeId || null,
        dueDate: values.dueDate || null,
        labelIds: values.labelIds,
      });
      toast.success(`${task.identifier} created`, { description: task.title });
      onCreated?.(task.id);
      onClose();
    } catch (error) {
      applyFormError(error, form.setError);
    } finally {
      onPendingChange(false);
    }
  });

  return (
    <form
      id={FORM_ID}
      onSubmit={onSubmit}
      noValidate
      className="space-y-4"
      aria-busy={isSubmitting}
    >
      {errors.root?.server && <Alert variant="danger">{errors.root.server.message}</Alert>}

      <FormField label="Title" error={errors.title?.message} required>
        <Input autoFocus placeholder="What needs to be done?" {...form.register('title')} />
      </FormField>

      <FormField label="Description" error={errors.description?.message}>
        <Textarea
          rows={4}
          placeholder="Add details, acceptance criteria, links…"
          {...form.register('description')}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Status" error={errors.status?.message}>
          <Select options={STATUS_OPTIONS} {...form.register('status')} />
        </FormField>
        <FormField label="Priority" error={errors.priority?.message}>
          <Select options={PRIORITY_OPTIONS} {...form.register('priority')} />
        </FormField>
        <FormField label="Assignee" error={errors.assigneeId?.message}>
          <Select {...form.register('assigneeId')}>
            <option value="">Unassigned</option>
            {assignees.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Due date" error={errors.dueDate?.message}>
          <Input type="date" {...form.register('dueDate')} />
        </FormField>
      </div>

      <FormField label="Labels">
        <Controller
          control={form.control}
          name="labelIds"
          render={({ field }) => (
            <LabelPicker
              label="Labels"
              variant="button"
              options={labels.data ?? []}
              value={(labels.data ?? []).filter((label) => field.value.includes(label.id))}
              onChange={(selected) => field.onChange(selected.map((label) => label.id))}
            />
          )}
        />
      </FormField>

      {/* Hidden submit so Enter in single-line inputs submits the form. */}
      <button type="submit" hidden disabled={isSubmitting} />
    </form>
  );
}
