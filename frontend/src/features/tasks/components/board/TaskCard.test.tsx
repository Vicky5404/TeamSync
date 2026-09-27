import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { alex, makeTask } from '@/test/fixtures';

import { TaskCard } from './TaskCard';

describe('TaskCard', () => {
  it('shows the identifier, title, labels and activity counters', () => {
    const task = makeTask({
      identifier: 'WEB-42',
      title: 'Ship the pricing page',
      assignee: alex,
      commentCount: 3,
      attachmentCount: 2,
      checklist: { total: 4, completed: 1 },
      labels: [
        { id: 'l1', name: 'Frontend', color: 'blue' },
        { id: 'l2', name: 'Bug', color: 'red' },
        { id: 'l3', name: 'Design', color: 'pink' },
        { id: 'l4', name: 'Urgent', color: 'orange' },
      ],
    });
    render(<TaskCard task={task} />);

    expect(screen.getByText('WEB-42')).toBeInTheDocument();
    expect(screen.getByText('Ship the pricing page')).toBeInTheDocument();
    // At most three labels, then an overflow counter.
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('Design')).toBeInTheDocument();
    expect(screen.queryByText('Urgent')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByTitle('Checklist')).toHaveTextContent('1/4');
    expect(screen.getByTitle('Comments')).toHaveTextContent('3');
    expect(screen.getByTitle('Attachments')).toHaveTextContent('2');
  });

  it('strikes through completed tasks and hides empty metadata', () => {
    render(<TaskCard task={makeTask({ title: 'Done already', status: 'DONE' })} />);
    expect(screen.getByText('Done already')).toHaveClass('line-through');
    expect(screen.queryByTitle('Comments')).not.toBeInTheDocument();
  });

  it('renders user-provided text as text, never as markup', () => {
    const { container } = render(
      <TaskCard task={makeTask({ title: '<img src=x onerror="alert(1)">' })} />,
    );
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
});
