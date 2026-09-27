import { describe, expect, it } from 'vitest';

import { ApiException } from '../errors/api-exception.js';

import { csvCell, csvRow } from './csv.js';
import { endOfWeekUTC, isISODate, startOfTodayUTC, toISODate } from './dates.js';
import { afterCursor, decodeCursor, encodeCursor, pageWindow, toCursorPage } from './pagination.js';
import { parseUserAgent } from './user-agent.js';

describe('pagination', () => {
  it('clamps the page window', () => {
    expect(pageWindow(57, 2, 20)).toEqual({
      page: 2,
      pageSize: 20,
      skip: 20,
      take: 20,
      totalPages: 3,
    });
    expect(pageWindow(57, 99, 20).page).toBe(3);
    expect(pageWindow(0, 5, 20)).toMatchObject({ page: 1, totalPages: 1, skip: 0 });
    expect(pageWindow(10, 1, 1000).pageSize).toBe(100);
  });

  it('round-trips keyset cursors and rejects tampered ones', () => {
    const row = {
      createdAt: new Date('2026-09-25T10:00:00.000Z'),
      id: '01a0dc35-2fbe-74cd-b51d-052e3e9f35a8',
    };
    expect(decodeCursor(encodeCursor(row))).toEqual(row);
    expect(() => decodeCursor('not-a-cursor')).toThrow(ApiException);
    expect(afterCursor(undefined)).toEqual({});
    expect(afterCursor(encodeCursor(row))).toEqual({
      OR: [{ createdAt: { lt: row.createdAt } }, { createdAt: row.createdAt, id: { lt: row.id } }],
    });
  });

  it('builds a cursor page from limit + 1 rows', () => {
    const row = (n: number) => ({
      createdAt: new Date(n * 1000),
      id: `00000000-0000-4000-8000-00000000000${n}`,
    });
    const second = row(2);
    const rows = [row(3), second, row(1)];
    const page = toCursorPage(rows, 2, (entry) => entry.id);
    expect(page.data).toHaveLength(2);
    expect(page.nextCursor).toBe(encodeCursor(second));
    expect(toCursorPage(rows, 5, (entry) => entry.id).nextCursor).toBeNull();
  });
});

describe('dates', () => {
  it('validates real calendar dates only', () => {
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-2-3')).toBe(false);
  });

  it('computes UTC day boundaries', () => {
    const now = new Date('2026-09-23T22:30:00.000Z'); // Wednesday
    expect(toISODate(startOfTodayUTC(now))).toBe('2026-09-23');
    expect(toISODate(endOfWeekUTC(now))).toBe('2026-09-27'); // Sunday
  });
});

describe('csv', () => {
  it('escapes delimiters and quotes', () => {
    expect(csvRow(['a,b', 'say "hi"', 3, null])).toBe('"a,b","say ""hi""",3,');
  });

  it('neutralizes spreadsheet formula injection', () => {
    expect(csvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell(-5)).toBe('-5'); // numbers are data, not formulas
  });
});

describe('parseUserAgent', () => {
  it('classifies common browsers', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      ),
    ).toEqual({ device: 'Desktop', browser: 'Chrome', os: 'Windows' });
    expect(
      parseUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({
      device: 'Mobile',
      browser: 'Safari',
      os: 'iOS',
    });
    expect(parseUserAgent(undefined).browser).toBe('Unknown');
  });
});
