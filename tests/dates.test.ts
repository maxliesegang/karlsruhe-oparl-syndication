import { describe, expect, it } from 'vitest';
import { isRecentFileDate, latestValidDate, parseValidDate } from '../src/dates.js';

describe('parseValidDate', () => {
  it('parses valid ISO strings', () => {
    expect(parseValidDate('2026-07-18T12:00:00Z')?.toISOString()).toBe('2026-07-18T12:00:00.000Z');
  });

  it('returns undefined for missing or malformed dates', () => {
    expect(parseValidDate(undefined)).toBeUndefined();
    expect(parseValidDate(null)).toBeUndefined();
    expect(parseValidDate('')).toBeUndefined();
    expect(parseValidDate('not-a-date')).toBeUndefined();
  });
});

describe('latestValidDate', () => {
  it('returns the most recent valid date, ignoring invalid ones', () => {
    const result = latestValidDate('2020-01-01', 'garbage', undefined, '2026-07-18T00:00:00Z');
    expect(result?.toISOString()).toBe('2026-07-18T00:00:00.000Z');
  });

  it('returns undefined when no valid date is present', () => {
    expect(latestValidDate(undefined, null, 'nope')).toBeUndefined();
  });
});

describe('isRecentFileDate', () => {
  it('accepts the current year and the preceding two years', () => {
    const year = new Date().getFullYear();

    expect(isRecentFileDate(`${year}-01-01`)).toBe(true);
    expect(isRecentFileDate(`${year - 2}-12-31`)).toBe(true);
    expect(isRecentFileDate(`${year - 3}-12-31`)).toBe(false);
  });

  it('treats an unparseable date as not recent', () => {
    // The previous substring check returned true for any string containing a
    // recent year, even when it was not a real date.
    expect(isRecentFileDate('')).toBe(false);
    expect(isRecentFileDate('not-a-date')).toBe(false);
  });
});
