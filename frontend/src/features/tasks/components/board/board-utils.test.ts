import { describe, expect, it } from 'vitest';

import { makeTask } from '@/test/fixtures';

import { groupTasksByStatus, isStatus, positionBetween, toColumnIds } from './board-utils';

describe('board utilities', () => {
  it('groups tasks into every status column, ordered by position', () => {
    const late = makeTask({ status: 'TODO', position: 3000 });
    const early = makeTask({ status: 'TODO', position: 1000 });
    const done = makeTask({ status: 'DONE', position: 500 });

    const groups = groupTasksByStatus([late, done, early]);

    expect(Object.keys(groups)).toEqual(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']);
    expect(groups.TODO.map((task) => task.id)).toEqual([early.id, late.id]);
    expect(groups.DONE).toEqual([done]);
    expect(groups.BACKLOG).toEqual([]);
    expect(toColumnIds(groups).TODO).toEqual([early.id, late.id]);
  });

  it('computes fractional positions so a move only updates the moved task', () => {
    expect(positionBetween(undefined, undefined)).toBe(1024);
    expect(positionBetween(undefined, 1024)).toBe(0);
    expect(positionBetween(2048, undefined)).toBe(3072);
    expect(positionBetween(1024, 2048)).toBe(1536);
    // Keeps working between very close neighbours (the API rebalances when needed).
    const tight = positionBetween(1024, 1024.000001);
    expect(tight).toBeGreaterThan(1024);
    expect(tight).toBeLessThan(1024.000001);
  });

  it('recognizes status ids', () => {
    expect(isStatus('IN_PROGRESS')).toBe(true);
    expect(isStatus('task-1')).toBe(false);
    expect(isStatus(undefined)).toBe(false);
  });
});
