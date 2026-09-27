import { act, renderHook, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query-keys';
import { tasksService } from '@/services';
import type { Task } from '@/types';
import { makeTask } from '@/test/fixtures';
import { createTestQueryClient, renderWithProviders } from '@/test/render';

import { useMoveTask } from '../../api/tasks.queries';
import { KanbanBoard } from './KanbanBoard';

vi.mock('@/services', () => ({
  tasksService: { move: vi.fn(), create: vi.fn() },
  organizationsService: { listLabels: vi.fn(() => Promise.resolve([])) },
}));

const move = vi.mocked(tasksService.move);

describe('KanbanBoard', () => {
  afterEach(() => move.mockReset());

  it('renders one column per status with its tasks in position order', () => {
    const tasks = [
      makeTask({ title: 'Second', status: 'TODO', position: 2048 }),
      makeTask({ title: 'First', status: 'TODO', position: 1024 }),
      makeTask({ title: 'Shipped', status: 'DONE', position: 1024 }),
    ];
    renderWithProviders(
      <KanbanBoard
        projectId="project-1"
        tasks={tasks}
        onOpenTask={vi.fn()}
        canEdit
        canCreate={false}
      />,
    );

    const todo = screen.getByRole('list', { name: 'To do tasks' });
    expect(
      within(todo)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([expect.stringContaining('First'), expect.stringContaining('Second')]);
    expect(
      within(screen.getByRole('list', { name: 'Done tasks' })).getByText('Shipped'),
    ).toBeInTheDocument();
    // Empty columns show a drop target instead of cards.
    expect(
      within(screen.getByRole('list', { name: 'Backlog tasks' })).getByRole('listitem'),
    ).toHaveTextContent('Drop tasks here');
  });

  it('only shows the requested columns (status filter)', () => {
    renderWithProviders(
      <KanbanBoard
        projectId="project-1"
        tasks={[]}
        statuses={['IN_PROGRESS', 'REVIEW']}
        onOpenTask={vi.fn()}
        canEdit={false}
        canCreate={false}
      />,
    );
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['In progress', 'In review']);
  });
});

describe('useMoveTask', () => {
  function setup(tasks: Task[]) {
    const queryClient = createTestQueryClient();
    const key = queryKeys.tasks.projectList('project-1', {});
    queryClient.setQueryData(key, tasks);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useMoveTask('project-1'), { wrapper });
    const cached = () => queryClient.getQueryData<Task[]>(key) ?? [];
    return { result, cached };
  }

  afterEach(() => move.mockReset());

  it('moves the card optimistically and marks it completed in the Done column', async () => {
    const task = makeTask({ status: 'REVIEW', position: 1024 });
    let resolve: (value: Task) => void = () => undefined;
    move.mockReturnValue(new Promise<Task>((done) => (resolve = done)));
    const { result, cached } = setup([task]);

    act(() => result.current.mutate({ taskId: task.id, status: 'DONE', position: 512 }));

    await waitFor(() => expect(cached()[0]).toMatchObject({ status: 'DONE', position: 512 }));
    expect(cached()[0]?.completedAt).not.toBeNull();
    expect(move).toHaveBeenCalledWith(task.id, { status: 'DONE', position: 512 });

    act(() => resolve({ ...task, status: 'DONE', position: 512 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls the card back when the server rejects the move', async () => {
    const task = makeTask({ status: 'TODO', position: 2048 });
    move.mockRejectedValue(new Error('Forbidden'));
    const { result, cached } = setup([task]);

    act(() => result.current.mutate({ taskId: task.id, status: 'IN_PROGRESS', position: 1024 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cached()[0]).toMatchObject({ status: 'TODO', position: 2048, completedAt: null });
  });
});
