import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/http';
import { organizationsService, tasksService } from '@/services';
import { useToastStore } from '@/store/toast.store';
import { alex, makeTask, sam } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { CreateTaskModal } from './CreateTaskModal';

vi.mock('@/services', () => ({
  tasksService: { create: vi.fn() },
  organizationsService: { listLabels: vi.fn() },
}));

const create = vi.mocked(tasksService.create);

function renderModal(onClose = vi.fn(), onCreated = vi.fn()) {
  renderWithProviders(
    <CreateTaskModal
      open
      onClose={onClose}
      onCreated={onCreated}
      projectId="project-1"
      assignees={[alex, sam]}
      defaultStatus="IN_PROGRESS"
    />,
  );
  return { onClose, onCreated };
}

describe('CreateTaskModal', () => {
  beforeEach(() => {
    vi.mocked(organizationsService.listLabels).mockResolvedValue([]);
  });

  afterEach(() => {
    create.mockReset();
    useToastStore.getState().clear();
  });

  it('requires a title', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the task in the chosen column and maps empty optional fields to null', async () => {
    const created = makeTask({ identifier: 'WEB-7', title: 'Write release notes' });
    create.mockResolvedValue(created);
    const { onClose, onCreated } = renderModal();

    expect(screen.getByLabelText('Status')).toHaveValue('IN_PROGRESS');
    await userEvent.type(screen.getByLabelText(/Title/), '  Write release notes  ');
    await userEvent.selectOptions(screen.getByLabelText('Assignee'), sam.id);
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'HIGH');
    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith('project-1', {
      title: 'Write release notes',
      description: null,
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      assigneeId: sam.id,
      dueDate: null,
      labelIds: [],
    });
    expect(onCreated).toHaveBeenCalledWith(created.id);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      variant: 'success',
      title: 'WEB-7 created',
    });
  });

  it('shows server-side validation errors on the matching field and keeps the modal open', async () => {
    create.mockRejectedValue(
      new ApiError('Some fields are invalid.', {
        status: 422,
        code: 'VALIDATION_ERROR',
        fieldErrors: { assigneeId: ['Assignee must be a member of the organization'] },
      }),
    );
    const { onClose } = renderModal();

    await userEvent.type(screen.getByLabelText(/Title/), 'Task');
    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));

    expect(
      await screen.findByText('Assignee must be a member of the organization'),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
